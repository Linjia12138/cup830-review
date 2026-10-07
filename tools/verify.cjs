// Run with Playwright installed: node tools/verify.cjs [site URL].
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const base=process.argv[2]||'http://127.0.0.1:8300/';
const out=path.resolve(__dirname,'../test-artifacts');
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  async function goto(hash){await page.goto(base+hash);await page.waitForSelector('main h1');}
  async function count(expected){await page.waitForFunction(n=>document.querySelector('[data-result-count]')?.dataset.resultCount===String(n),expected);assert.equal(await page.locator('[data-result-count]').getAttribute('data-result-count'),String(expected));}
  async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal page overflow');}
  await goto('#home');await noOverflow();
  await page.screenshot({path:path.join(out,'home-desktop.png'),fullPage:true});
  await page.getByRole('link',{name:'知识点',exact:true}).click();
  await page.getByRole('link',{name:/汽蚀、气缚、安装与开停/}).click();
  await page.waitForFunction(()=>document.querySelector('main h1')?.textContent.includes('汽蚀'));
  assert.match(await page.locator('main h1').innerText(),/汽蚀/);
  await page.getByRole('link',{name:/只看近五年/}).click();await count(6);
  await page.locator('.q-card h3 a').first().click();
  await page.waitForSelector('.scan-image');
  await page.waitForFunction(()=>document.querySelector('.scan-image')?.complete&&document.querySelector('.scan-image')?.naturalWidth===2000);
  assert.ok(await page.locator('.scan-image').first().evaluate(img=>img.complete&&img.naturalWidth===2000));
  await page.locator('[data-zoom]').first().click();
  assert.ok(await page.locator('#scan-dialog').evaluate(d=>d.open));
  await page.locator('#scan-close').click();
  await page.locator('details.ocr summary').click();assert.ok((await page.locator('.ocr-text').innerText()).length>20);
  await page.getByRole('button',{name:'☆ 收藏这道题',exact:true}).click();
  await page.locator('#question-note').fill('复习记录：汽蚀措施需要结合吸入阻力解释。');
  await page.getByRole('button',{name:'保存笔记',exact:true}).click();
  const questionUrl=page.url();
  await page.reload();assert.equal(await page.locator('#question-note').inputValue(),'复习记录：汽蚀措施需要结合吸入阻力解释。');
  await page.getByRole('link',{name:/我的收藏/}).click();await count(1);
  assert.match(await page.locator('.saved-note').innerText(),/汽蚀措施/);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:/导出收藏与笔记/}).click();
  const download=await dl;const backup=path.join(out,'backup.json');await download.saveAs(backup);
  const saved=JSON.parse(fs.readFileSync(backup,'utf8'));assert.equal(saved.saved.length,1);assert.equal(Object.keys(saved.notes).length,1);
  await page.locator('.bookmark').click();await page.reload();await count(0);
  await page.locator('#backup-file').setInputFiles(backup);await count(1);
  await page.goto(questionUrl);await page.waitForSelector('#question-note');
  await goto('#questions?recent=1');await count(120);
  await goto('#questions?recent=1&type='+encodeURIComponent('计算'));await count(24);
  await goto('#questions?type='+encodeURIComponent('计算'));await count(84);
  await goto('#questions?year=2025');await count(20);
  await goto('#questions?year=2023');await count(29);
  await goto('#questions?topic=A4&recent=1&type='+encodeURIComponent('计算'));await count(5);
  await goto('#questions?q='+encodeURIComponent('汽蚀'));assert.ok(Number(await page.locator('[data-result-count]').getAttribute('data-result-count'))>=6);
  await goto('#questions?q=nonexistentXYZ');await count(0);assert.ok(await page.getByRole('heading',{name:'没有找到符合条件的题目'}).isVisible());
  await goto('#questions?year=2025');await page.selectOption('#q-type','计算');await count(5);assert.match(page.url(),/year=2025/);
  await page.goBack();await count(20);
  await goto('#question/'+encodeURIComponent('2025-六'));await noOverflow();
  await page.screenshot({path:path.join(out,'question-desktop.png'),fullPage:true});
  await goto('#topic/A4');await noOverflow();
  await page.screenshot({path:path.join(out,'topic-desktop.png'),fullPage:true});
  for(const t of await page.evaluate(()=>EXAM_DB.topics)){
    await goto('#questions?topic='+t.code);await count(t.all_questions);
  }
  for(const hash of ['#home','#topics','#questions','#years','#year/2025','#syllabus','#saved','#topic/A4','#question/'+encodeURIComponent('2025-七')]){
    await page.setViewportSize({width:390,height:844});await goto(hash);await noOverflow();
  }
  await goto('#home');await page.screenshot({path:path.join(out,'home-mobile.png'),fullPage:true});
  await goto('#question/'+encodeURIComponent('2025-七'));await page.screenshot({path:path.join(out,'question-mobile.png'),fullPage:true});
  await page.setViewportSize({width:320,height:760});
  for(const hash of ['#home','#questions','#syllabus','#topic/A4','#question/'+encodeURIComponent('2024-四-02')]){await goto(hash);await noOverflow();}
  assert.deepEqual(errors,[],'browser errors');
  const assets=await page.evaluate(()=>[...new Set(EXAM_DB.questions.flatMap(q=>q.pageImages))]);
  for(const asset of assets){const response=await context.request.get(new URL(asset,base).href);assert.equal(response.status(),200,asset);}
  for(const asset of ['downloads/830-review.xlsx','downloads/830-review.md']){const response=await context.request.get(new URL(asset,base).href);assert.equal(response.status(),200,asset);}
  console.log(JSON.stringify({status:'passed',topicFilters:34,scanPages:assets.length,viewports:[1440,390,320],features:['topic to question to scan','combined filters','back navigation','bookmarks','notes persist','backup export/import','downloads','no browser errors']},null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
