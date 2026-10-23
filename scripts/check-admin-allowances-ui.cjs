/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS harness resolves optional test tools through NODE_PATH. */
// Browser interaction checks with mocked server actions, not live Supabase.
// Requires esbuild and playwright-core via NODE_PATH or local installation.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
const actions = `
window.calls=[]; window.loads=0;
const states={};
export async function loadAdminUserUsage(id){
  window.loads++; await new Promise(r=>setTimeout(r,50));
  if(window.failLoad)return {success:false,message:'Could not load usage. Please try again.'};
  const a=states[id]||{mode:'custom',materialLimit:8,tutorLimit:15};
  const bucket=limit=>({attempts24h:1,limit,remaining:limit===null?null:limit-1,nextAttemptExpiresAt:'2026-10-09T01:00:00Z'});
  return {success:true,usage:{userId:id,checkedAt:new Date().toISOString(),mode:a.mode,canEdit:!window.readOnly,editReason:window.readOnly?'Only a Super Admin can change usage allowances.':null,source:'allowance',materials:bucket(a.mode==='default'?5:a.materialLimit),tutor:bucket(a.mode==='default'?20:a.tutorLimit)}};
}
export async function saveAdminUserAllowance(input){
  window.calls.push(input);await new Promise(r=>setTimeout(r,350));
  if(window.failSave){window.failSave=false;throw new Error('network interrupted');}
  states[input.targetUserId]={mode:input.mode,materialLimit:input.materialLimit,tutorLimit:input.tutorLimit};
  return {success:true,duplicate:false,allowance:states[input.targetUserId]};
}`;

(async () => {
  let browser; let server;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-allowance-ui-'));
  try {
    await esbuild.build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import Profile from '${root}/app/(admin)/components/AdminUserProfile';
        const users=['Ada','Bea'].map((name,i)=>({id:'00000000-0000-4000-8000-00000000000'+i,displayName:name,email:name+'@example.test',createdAt:'2026-01-01T00:00:00Z',lastSignInAt:null,emailConfirmed:true,isAdmin:false}));
        createRoot(document.getElementById('root')).render(<main>{users.map(user=><Profile key={user.id} user={user}/>)}</main>);`,
        loader: 'tsx', resolveDir: root },
      bundle: true, jsx: 'automatic', outfile: path.join(temp, 'app.js'), nodePaths: [root + '/node_modules'],
      plugins: [{ name: 'mock-actions', setup(build) {
        build.onResolve({filter:/usage-actions$/}, () => ({path:'actions',namespace:'mock'}));
        build.onLoad({filter:/.*/,namespace:'mock'}, () => ({contents:actions,loader:'js'}));
      }}],
    });
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
      res.end(req.url === '/app.js' ? fs.readFileSync(path.join(temp, 'app.js')) : '<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div><script src="/app.js"></script>');
    }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    browser = await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const page = await browser.newPage();
    const errors=[]; page.on('pageerror', e => errors.push(e.message));
    const url = 'http://127.0.0.1:' + server.address().port;
    let checks=0;
    function check(value){assert.ok(value);checks++;}
    await page.goto(url);
    check(await page.evaluate(()=>window.loads)===0);
    await page.getByRole('button',{name:'Ada',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:'Review change',exact:true}).waitFor();
    check(await dialog.getByRole('spinbutton',{name:'Study material generations'}).inputValue()==='8');
    check(await dialog.getByRole('spinbutton',{name:'Tutor messages'}).inputValue()==='15');
    await dialog.getByRole('button',{name:'Review change',exact:true}).click();
    check(await dialog.getByRole('alert').textContent()==='Please enter a reason.');
    await dialog.getByRole('spinbutton',{name:'Study material generations'}).fill('1001');
    await dialog.getByRole('button',{name:'Review change',exact:true}).click();
    check((await dialog.getByRole('alert').textContent()).includes('1 to 1000'));
    await dialog.getByRole('radio',{name:'Unlimited',exact:true}).check();
    await dialog.getByRole('textbox',{name:'Reason (saved in the activity log)'}).fill('Exam preparation');
    await dialog.getByRole('button',{name:'Review change',exact:true}).click();
    await page.evaluate(()=>{window.failSave=true;});
    await dialog.getByRole('button',{name:'Confirm and save',exact:true}).click();
    check(await dialog.getByRole('button',{name:'Close user profile'}).isDisabled());
    await page.keyboard.press('Escape');
    check(await dialog.isVisible());
    await dialog.getByRole('alert').filter({hasText:'Could not confirm'}).waitFor();
    check(await dialog.getByRole('button',{name:'Confirm and save'}).isEnabled());
    await dialog.getByRole('button',{name:'Confirm and save'}).click();
    await dialog.getByText('Unlimited personal allowance',{exact:true}).waitFor();
    check(await page.evaluate(()=>window.calls.length)===2);
    check(await page.evaluate(()=>window.calls[0].requestId===window.calls[1].requestId));
    check(await dialog.getByText('No personal app limit',{exact:true}).count()===2);
    check(await dialog.getByRole('radio',{name:'Unlimited',exact:true}).isChecked());
    await page.keyboard.press('Escape');
    check(await page.getByRole('button',{name:'Ada',exact:true}).evaluate(el=>el===document.activeElement));
    await page.getByRole('button',{name:'Bea',exact:true}).click();
    await dialog.getByRole('button',{name:'Review change',exact:true}).waitFor();
    check(await dialog.getByRole('radio',{name:'Custom limits',exact:true}).isChecked());
    check(await dialog.getByRole('spinbutton',{name:'Study material generations'}).inputValue()==='8');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{window.readOnly=true;});
    await page.getByRole('button',{name:'Ada',exact:true}).click();
    await dialog.getByText('Only a Super Admin can change usage allowances.',{exact:true}).waitFor();
    check(await dialog.getByRole('button',{name:'Review change'}).count()===0);
    await page.evaluate(()=>{window.failLoad=true;});
    await dialog.getByRole('button',{name:'Refresh',exact:true}).click();
    await dialog.getByRole('alert').waitFor();
    check(await dialog.getByRole('button',{name:'Review change'}).count()===0);
    await page.evaluate(()=>{window.failLoad=false;});
    await dialog.getByRole('button',{name:'Retry',exact:true}).click();
    await dialog.getByText('Unlimited personal allowance',{exact:true}).waitFor();
    check(errors.length===0);
    console.log(`Passed ${checks} browser assertions with mocked actions.`);
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
