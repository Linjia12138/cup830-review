'use strict';
(() => {
  const db = window.EXAM_DB;
  const main = document.getElementById('main');
  const byId = new Map(db.questions.map(q => [q.id,q]));
  const topics = new Map(db.topics.map(t => [t.code,t]));
  const chapterNames = [...new Set(db.topics.map(t=>t.chapter))];
  const PAGE_SIZE = 24;
  const STORAGE_KEY = 'cup830-review-v1';
  let personal = {saved:[],notes:{}};
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored) personal = sanitizePersonal(stored);
  } catch (_) { /* Storage may be unavailable in private browsers. */ }
  function sanitizePersonal(v) {
    const saved = Array.isArray(v.saved) ? [...new Set(v.saved.filter(id=>byId.has(id)))] : [];
    const notes = {};
    if (v.notes && typeof v.notes === 'object') for (const [id,note] of Object.entries(v.notes)) {
      if (byId.has(id) && typeof note==='string' && note.trim()) notes[id]=note.slice(0,20000);
    }
    return {saved,notes};
  }
  const e = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const enc = encodeURIComponent;
  const number = n => Number(n).toLocaleString('zh-CN');
  const isRecent = q => db.recent.includes(q.year);
  const isSaved = id => personal.saved.includes(id);
  const moduleFor = code => db.modules.find(m=>m.codes.includes(code));
  const qsFor = code => db.questions.filter(q=>q.topics.includes(code));
  const short = (value,n=120) => { const s = String(value).replace(/\s+/g,' ').trim(); return s.length>n?s.slice(0,n)+'…':s; };
  function route() {
    const raw = location.hash.slice(1) || 'home';
    const i = raw.indexOf('?');
    const path = i<0?raw:raw.slice(0,i);
    return {parts:path.split('/').map(decodeURIComponent),params:new URLSearchParams(i<0?'':raw.slice(i+1))};
  }
  function link(path,params={}) {
    const p = new URLSearchParams();
    for (const [key,value] of Object.entries(params)) if (value!=='' && value!=null && value!==false) p.set(key,value===true?'1':String(value));
    return '#'+path+(p.size?'?'+p.toString():'');
  }
  function pageLink(path,params,page) { return link(path,{...Object.fromEntries(params),page:page===1?'':page}); }
  function chip(code) {
    const t = topics.get(code);
    return t ? `<a class="chip ${code.startsWith('O')?'gold':''}" href="#topic/${e(code)}">${e(t.name)}</a>` : '';
  }
  function bookmark(q) {
    return `<button class="bookmark ${isSaved(q.id)?'saved':''}" type="button" data-bookmark="${e(q.id)}" aria-label="${isSaved(q.id)?'取消收藏':'收藏'}：${e(q.title)}" aria-pressed="${isSaved(q.id)}" title="${isSaved(q.id)?'取消收藏':'收藏这道题'}">${isSaved(q.id)?'★':'☆'}</button>`;
  }
  function highlight(text,query) {
    const escaped = e(text);
    if (!query || /\s/.test(query)) return escaped;
    const needle = e(query).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return escaped.replace(new RegExp(needle,'gi'),s=>`<mark>${s}</mark>`);
  }
  function qCard(q,{query='',notes=false}={}) {
    return `<article class="q-card" data-question="${e(q.id)}">
      ${bookmark(q)}<div class="q-meta"><strong>${q.year}</strong><span>${e(q.type)}</span><span>${e(q.locator.replace(/^\d+年\s*/,''))}</span>${q.marks!=null?`<span>资料标注 ${q.marks} 分</span>`:''}</div>
      <h3><a href="#question/${enc(q.id)}">${highlight(q.title,query)}</a></h3>
      <p class="q-excerpt">${highlight(short(q.text),query)}</p>
      <div class="q-tags">${q.topics.length?q.topics.map(chip).join(''):'<span class="chip gold">知识点待判定</span>'}</div>
      ${notes&&personal.notes[q.id]?`<div class="saved-note">我的笔记：${e(short(personal.notes[q.id],220))}</div>`:''}
    </article>`;
  }
  function qGrid(items,opts) { return `<div class="q-grid">${items.map(q=>qCard(q,opts)).join('')}</div>`; }
  function empty(title='没有找到符合条件的题目',desc='试着放宽年份或题型，或改用一个关键词。',target='#questions',label='浏览全部题目') {
    return `<div class="empty"><h2>${e(title)}</h2><p>${e(desc)}</p><a class="btn" href="${e(target)}">${e(label)}</a></div>`;
  }
  function pager(total,params,path='questions') {
    const pages = Math.ceil(total/PAGE_SIZE);
    if (pages<=1) return '';
    const page = Math.max(1,Math.min(pages,Number(params.get('page'))||1));
    const show = new Set([1,pages,page-1,page,page+1].filter(x=>x>=1&&x<=pages));
    let prev=0;
    const links=[];
    for (const p of [...show].sort((a,b)=>a-b)) {
      if(p>prev+1) links.push('<span>…</span>');
      links.push(`<a href="${e(pageLink(path,params,p))}" ${p===page?'class="active" aria-current="page"':''}>${p}</a>`);prev=p;
    }
    return `<nav class="pager" aria-label="题库分页">${page>1?`<a href="${e(pageLink(path,params,page-1))}">上一页</a>`:''}${links.join('')}${page<pages?`<a href="${e(pageLink(path,params,page+1))}">下一页</a>`:''}<span>共 ${pages} 页</span></nav>`;
  }
  function pageItems(items,params) {
    const page=Math.max(1,Math.min(Math.ceil(items.length/PAGE_SIZE)||1,Number(params.get('page'))||1));
    return items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  }
  function home() {
    const recentCalcs = db.questions.filter(q=>isRecent(q)&&q.type==='计算');
    const primaryModules = db.modules.slice(0,5);
    return `<section class="hero">
      <div><span class="eyebrow">2026年12月初试 · 2027年招生</span><h1>从考点出发，<br>回到每一道题。</h1><p class="intro">把历年题目、考频和现行大纲放在一起。先判断复习重点，再点进知识点看具体怎么考、哪年考过，以及原题里的图和公式。</p>
      <form class="search-box" data-search="questions" role="search"><input name="q" type="search" placeholder="搜索题目或知识点，例如：汽蚀、最小回流比" aria-label="搜索题目或知识点"><button class="btn btn-primary">查找题目 →</button></form></div>
      <div class="hero-side"><span class="eyebrow">当前可核对的主统计样本</span><h2>1999—2010 / 2021—2025</h2><p>近五年取 2021—2025。按原题编号计数，题目可覆盖多个知识点。</p><div class="stat-grid"><div class="stat"><strong>373</strong><span>题目索引</span></div><div class="stat"><strong>34</strong><span>知识点</span></div><div class="stat"><strong>17</strong><span>年份样本</span></div><div class="stat"><strong>${recentCalcs.length}</strong><span>近五年计算题</span></div></div></div>
    </section>
    <div class="notice"><span class="notice-symbol">↗</span><p>目前缺少 <b>2026 招生年份题卷</b>；资料上的“2026最新版”是汇编版本。2011—2020 的模拟整理资料未纳入考频。<a href="#syllabus">查看来源与统计说明</a></p></div>
    <div class="section-heading"><div><span class="eyebrow">优先练习</span><h2>五条计算主线</h2></div><a class="text-link" href="${link('questions',{recent:1,type:'计算'})}">查看 24 道题 →</a></div>
    <div class="module-grid">${primaryModules.map((m,i)=>{
      const years = db.recent.filter(y=>db.questions.some(q=>q.year===y&&q.type==='计算'&&q.topics.some(c=>m.codes.includes(c))));
      return `<a class="module-card" href="${e(link('questions',{module:m.name,recent:1,type:'计算'}))}"><span class="number">0${i+1} / 计算</span><h3>${e(m.name)}</h3><div class="frequency"><strong>${m.calc}/5</strong><span>年有计算题</span></div><div class="year-dots" aria-label="2021至2025计算题覆盖">${db.recent.map(y=>`<span class="${years.includes(y)?'on':''}" title="${y} ${years.includes(y)?'有计算题':'未见独立计算题'}"></span>`).join('')}</div><small>近五年 ${db.questions.filter(q=>isRecent(q)&&q.type==='计算'&&q.topics.some(c=>m.codes.includes(c))).length} 道计算题</small><span class="arrow">对应题目 →</span></a>`;
    }).join('')}</div>
    <div class="section-heading"><h2>计算之外，也要会解释</h2><span class="muted">概念、简答与操作分析</span></div>
    <div class="columns"><section class="panel"><h2>这些原理反复出现</h2><div class="compact-links">${['P2','T1','A2','A1','X1'].map(c=>{const t=topics.get(c);return `<a href="#topic/${c}"><span>${e(t.name)}</span><small>近五年 ${t.recent_years}/5 年 ↗</small></a>`;}).join('')}</div></section>
      <section class="panel"><h2>先建立方法，再练习变化</h2><p class="muted">同一条计算主线既会考数值，也会考条件改变后的原因、趋势与推导。知识点页列出训练目标、常见错误和对应题目。</p><p class="muted">流态化、萃取、扩散等按大纲补齐；辐射、干燥等未列入现行大纲的历史内容单独标记。</p><div class="detail-actions"><a class="btn btn-primary" href="#topics">查看知识点</a><a class="btn" href="#syllabus">对照考试大纲</a></div></section></div>
    <div class="section-heading"><h2>从最近一套开始</h2><a class="text-link" href="#year/2025">完整浏览 2025 年 →</a></div>
    ${qGrid(db.questions.filter(q=>q.year===2025&&q.type==='计算').slice(0,4))}
    <div class="section-heading"><h2>带走整理结果</h2><span class="muted">原有表格与完整解读</span></div>
    <div class="detail-actions"><a class="btn" href="downloads/830-review.xlsx" download>↓ 考频与题目索引 Excel</a><a class="btn" href="downloads/830-review.md" download>↓ 复习重点解读</a></div>`;
  }
  function topicCard(t) {
    return `<a class="topic-card" href="#topic/${e(t.code)}"><div class="topic-meta"><span>${e(t.chapter)} · ${e(t.code)}</span><span>${e(t.requirement)}</span></div><h3>${e(t.name)}</h3><p class="topic-focus">${e(t.focus)}</p><span class="chip ${t.code.startsWith('O')?'gold':'gray'}">${e(t.priority)}</span><div class="topic-stats"><div><b>${t.recent_years}/5</b><small>近五年出现</small></div><div><b>${t.recent_calc_years}/5</b><small>计算出现</small></div><div><b>${t.all_questions}</b><small>覆盖题数</small></div></div></a>`;
  }
  function topicCatalog(params) {
    const query=(params.get('q')||'').trim();
    const mod=params.get('module')||'';
    const scope=params.get('scope')||'all';
    let ts=db.topics.filter(t=>(!mod||moduleFor(t.code)?.name===mod)&&(!query||[t.name,t.focus,t.chapter,t.code].join(' ').toLowerCase().includes(query.toLowerCase()))&&(scope==='all'||(scope==='current'?!t.code.startsWith('O'):t.code.startsWith('O'))));
    return `<header class="page-head"><span class="eyebrow">考点目录</span><h1>每个知识点，都有题目可追溯。</h1><p class="page-intro">点击卡片查看历年覆盖、训练重点和对应原题。年频次按同年去重，覆盖题数可跨考点重叠。</p></header>
      <form class="filters" data-search="topics"><div class="filter wide"><label for="topic-query">搜索知识点</label><input id="topic-query" name="q" type="search" value="${e(query)}" placeholder="名称、章节或考点编号"></div><div class="filter"><label for="topic-module">模块</label><select id="topic-module" name="module">${options(['',...db.modules.map(m=>m.name)],mod,'全部模块')}</select></div><div class="filter"><label for="topic-scope">大纲范围</label><select id="topic-scope" name="scope">${options([{v:'all',l:'全部 34 个考点'},{v:'current',l:'现行大纲'},{v:'history',l:'历史内容 · 降级'}],scope)}</select></div><button class="btn btn-primary">筛选</button></form>
      <div class="results-line"><span><strong>${ts.length}</strong> 个知识点</span><a href="#topics" class="text-link">重置筛选</a></div>
      ${ts.length?`<div class="topic-grid">${ts.map(topicCard).join('')}</div>`:empty('没有找到对应知识点','试着换一个关键词。','#topics','查看全部知识点')}`;
  }
  function options(items,selected,allLabel='全部') {
    return items.map(item=>{
      const v=typeof item==='object'?item.v:item;
      const l=typeof item==='object'?item.l:(v===''?allLabel:v);
      return `<option value="${e(v)}" ${String(v)===String(selected)?'selected':''}>${e(l)}</option>`;
    }).join('');
  }
  function topicDetail(code) {
    const t=topics.get(code);
    if(!t) return empty('知识点不存在','请从知识点目录重新选择。','#topics','返回知识点');
    const mod=moduleFor(code);
    const guide=db.guides.find(g=>g.module===mod?.name);
    const recent=qsFor(code).filter(isRecent).sort((a,b)=>b.year-a.year);
    return `<div class="crumbs"><a href="#topics">知识点</a><span>/</span><span>${e(t.chapter)}</span><span>/</span><span>${e(code)}</span></div>
      <section class="topic-hero"><div><span class="eyebrow">${e(t.syllabus)} · ${e(t.requirement)}</span><h1>${e(t.name)}</h1><p class="page-intro">${e(t.focus)}</p><span class="chip ${code.startsWith('O')?'gold':''}">${e(t.priority)}</span><div class="detail-actions"><a class="btn btn-primary" href="${e(link('questions',{topic:code}))}">查看全部 ${t.all_questions} 道题 →</a><a class="btn" href="${e(link('questions',{topic:code,recent:1}))}">只看近五年</a></div></div>
      <div class="metric-panel"><div><strong>${t.recent_years}/5 年</strong><small>近五年出现</small></div><div><strong>${t.recent_calc_years}/5 年</strong><small>近五年计算出现</small></div><div><strong>${t.all_years}/17 年</strong><small>全部样本出现</small></div><div><strong>${t.recent_questions} 道</strong><small>近五年对应题目</small></div></div></section>
      ${code.startsWith('O')?'<div class="notice"><span class="notice-symbol">i</span><p>这部分为历史题目，现行大纲未列。复习优先级降级；保留原题用于了解资料边界。</p></div>':''}
      <section class="panel guide"><h2>怎样练到大纲要求</h2><div class="guide-grid"><div><div class="label">这个考点</div><p>${e(t.focus)}。掌握深度按“${e(t.requirement)}”要求，对照下方实际题目。</p>${guide?`<div class="label">整条主线的方法</div><p>${e(guide.method)}</p>`:''}</div><div>${guide?`<div class="label">常见错误</div><p>${e(guide.pitfalls)}</p><div class="label">原理与操作分析</div><p>${e(guide.concept)}</p>`:`<div class="label">练习方向</div><p>先准备定义、适用条件与影响因素，再练习该考点的填空、选择、简答。近期没有记录不代表大纲要求可以跳过。</p>`}</div></div>${guide?`<div class="inline-guide"><h3>同模块代表题</h3>${guide.examples.map(id=>{const q=byId.get(id);return `<a class="chip" href="#question/${enc(id)}">${e(q.year+' · '+q.title)}</a>`;}).join('')}</div>`:''}</section>
      <div class="section-heading"><h2>历年出现情况</h2><span class="muted">点击年份，直接看当年的题</span></div><div class="heatmap-wrap"><div class="heatmap">${db.years.map(y=>`<a class="heat-cell ${t.years[y]?'has':''} ${db.recent.includes(y)?'recent':''}" href="${e(link('questions',{topic:code,year:y}))}" aria-label="${y}年 ${t.years[y]||0}道对应题"><span>${y}</span><b>${t.years[y]||0}</b></a>`).join('')}</div></div><p class="heatmap-hint">格内为原编号题数；金色上沿为近五年。2011—2020 不在主统计中。</p>
      <div class="section-heading"><h2>近五年对应题目</h2><a class="text-link" href="${e(link('questions',{topic:code}))}">包括早期题目，共 ${t.all_questions} 道 →</a></div>${recent.length?qGrid(recent):empty('近五年样本未记录','仍需按现行大纲补齐；可以查看早期题目。',link('questions',{topic:code}),'查看历史题目')}`;
  }
  function filterQuestions(params,source=db.questions) {
    const year=params.get('year'),type=params.get('type'),mod=db.modules.find(m=>m.name===params.get('module')),code=params.get('topic');
    const words=(params.get('q')||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const recent=params.get('recent')==='1';
    let items=source.filter(q=>
      (!year||q.year===Number(year))&&(!type||q.type===type)&&(!mod||q.topics.some(c=>mod.codes.includes(c)))&&(!code||q.topics.includes(code))&&(!recent||isRecent(q))&&
      (!words.length||words.every(word=>[q.year,q.title,q.text,q.locator,...q.topics.map(c=>topics.get(c)?.name||'')].join(' ').toLowerCase().includes(word)))
    );
    const asc=params.get('sort')==='oldest';
    return items.sort((a,b)=>asc?a.year-b.year:b.year-a.year);
  }
  function questionFilters(params,path='questions') {
    return `<form class="filters" data-search="${path}"><div class="filter wide"><label for="q-search">关键词</label><input id="q-search" name="q" type="search" value="${e(params.get('q')||'')}" placeholder="题干、知识点或多个关键词"></div>
      <div class="filter"><label for="q-year">年份</label><select id="q-year" name="year">${options(['',...db.years.slice().reverse()],params.get('year')||'','全部 17 年')}</select></div>
      <div class="filter"><label for="q-type">题型</label><select id="q-type" name="type">${options(['',...new Set(db.questions.map(q=>q.type))],params.get('type')||'','全部题型')}</select></div>
      <div class="filter"><label for="q-module">模块</label><select id="q-module" name="module">${options(['',...db.modules.map(m=>m.name)],params.get('module')||'','全部模块')}</select></div>
      <div class="filter"><label for="q-topic">具体知识点</label><select id="q-topic" name="topic">${options([{v:'',l:'全部知识点'},...db.topics.map(t=>({v:t.code,l:t.code+' · '+t.name}))],params.get('topic')||'')}</select></div>
      <div class="filter"><label for="q-sort">排序</label><select id="q-sort" name="sort">${options([{v:'',l:'年份从新到旧'},{v:'oldest',l:'年份从旧到新'}],params.get('sort')||'')}</select></div>
      <label class="toggle"><input type="checkbox" name="recent" value="1" ${params.get('recent')==='1'?'checked':''}> 仅近五年（2021—2025）</label><button class="btn btn-primary">查找题目</button></form>`;
  }
  function library(params) {
    const items=filterQuestions(params);
    const code=params.get('topic'),mod=params.get('module');
    return `<header class="page-head"><span class="eyebrow">题目索引</span><h1>${code&&topics.has(code)?e(topics.get(code).name):mod?e(mod):'找到想练的那一道题。'}</h1><p class="page-intro">可按知识点、年份、题型交叉筛选。题目详情保留原题扫描页，文字识别用于检索。${code&&topics.has(code)?`<a class="text-link" href="#topic/${e(code)}">返回考点详解 →</a>`:''}</p></header>
      ${questionFilters(params)}<div class="results-line"><span data-result-count="${items.length}"><strong>${number(items.length)}</strong> 道符合条件的题目</span><a class="text-link" href="#questions">重置全部条件</a></div>
      ${items.length?qGrid(pageItems(items,params),{query:params.get('q')}):empty()}${pager(items.length,params)}`;
  }
  function scans(source,pages,images) {
    return pages.map((page,i)=>`<figure class="scan-frame"><figcaption class="scan-bar"><span>原 PDF 第 <b>${page}</b> 页${pages.length>1?' · '+(i+1)+'/'+pages.length:''}</span><button class="btn btn-small" type="button" data-zoom="${e(images[i])}" data-caption="${e(source+' · PDF第'+page+'页')}">放大查看 ↗</button></figcaption><img class="scan-image" src="${e(images[i])}" alt="${e(source+' PDF第'+page+'页的原题扫描') }" loading="${i===0?'eager':'lazy'}" decoding="async" data-zoom="${e(images[i])}" data-caption="${e(source+' · PDF第'+page+'页')}"></figure>`).join('');
  }
  function questionDetail(id) {
    const q=byId.get(id);
    if(!q) return empty('题目不存在','请从题库重新选择。');
    const c=db.coverage.find(c=>c.year===q.year);
    const sameYear=db.questions.filter(x=>x.year===q.year);
    const index=sameYear.findIndex(x=>x.id===id);
    const prev=sameYear[index-1],next=sameYear[index+1];
    const mod=moduleFor(q.primary);
    const guide=db.guides.find(g=>g.module===mod?.name);
    return `<div class="crumbs"><a href="#questions">题库</a><span>/</span><a href="#year/${q.year}">${q.year} 年</a><span>/</span><span>${e(q.locator.replace(/^\d+年\s*/,''))}</span></div>
      <header class="detail-title"><span class="eyebrow">${e(q.locator)}</span><h1>${e(q.title)}</h1><div class="detail-meta"><span class="chip gray">${q.year} 年 · ${e(q.type)}</span><span class="chip gray">${q.marks!=null?'资料标注 '+q.marks+' 分':'分值未单独标注'}</span><span class="chip ${q.material.includes('回忆')?'gold':'gray'}">${e(q.material)}</span></div><div class="q-tags">${q.topics.length?q.topics.map(chip).join(''):'<span class="chip gold">题干残缺，知识点未判定</span>'}</div><div class="detail-actions"><button class="btn ${isSaved(id)?'btn-primary':''}" type="button" data-bookmark="${e(id)}" aria-pressed="${isSaved(id)}">${isSaved(id)?'★ 已收藏':'☆ 收藏这道题'}</button><button class="btn" type="button" data-copy>复制题目链接</button><a class="btn" href="#year/${q.year}">查看该年全卷</a></div></header>
      <div class="q-detail-layout"><div><div class="source-note"><p><b>来源：</b>${e(q.source)} · PDF ${q.pages.join('、')} 页。整页保留原始图与公式，请按“${e(q.locator)}”定位。</p><p>${e(q.note)}</p><p>该年资料说明：${e(c.note||'题卷汇编，未独立核实为官方原卷。')}</p></div>
      ${scans(q.source,q.pages,q.pageImages)}
      <details class="ocr"><summary>查看题干文字（识别摘录）</summary><p class="muted">文字可能存在缺字、上下标与单位错误。计算和读图请以扫描页为准；这里未补造标准答案。</p><div class="ocr-text">${e(q.text)}</div></details>
      <section class="panel notes"><h2>我的练习笔记</h2><p class="muted">记录思路、易错点或自己的解答。保存在此浏览器，可从“我的收藏”导出备份。</p><textarea id="question-note" maxlength="20000" aria-label="这道题的个人笔记" placeholder="例如：先列全塔物料衡算；注意用摩尔比基准……">${e(personal.notes[id]||'')}</textarea><button class="btn btn-primary" type="button" data-save-note="${e(id)}">保存笔记</button><span class="muted" id="note-status"></span></section>
      <div class="bottom-links">${prev?`<a href="#question/${enc(prev.id)}">← 上一题<br>${e(prev.title)}</a>`:'<span></span>'}${next?`<a href="#question/${enc(next.id)}">下一题 →<br>${e(next.title)}</a>`:''}</div></div>
      <aside><section class="panel"><h3>回到知识点</h3><div class="compact-links">${q.topics.map(code=>{const t=topics.get(code);return `<a href="#topic/${e(code)}"><span>${e(t.name)}</span><small>${t.recent_years}/5 年</small></a>`;}).join('')||'<p class="muted">该题未判定知识点。</p>'}</div><p class="muted" style="margin-top:13px">年数为近五年资料覆盖，不是命题概率。</p></section>${guide?`<section class="panel guide"><h3>练这类题时</h3><p>${e(guide.method)}</p><div class="label">核对易错点</div><p>${e(guide.pitfalls)}</p><a class="text-link" href="${e(link('questions',{module:mod.name,type:q.type}))}">继续练同类题 →</a></section>`:''}<section class="panel"><h3>原页另开窗口</h3>${q.pageImages.map((img,i)=>`<p><a class="text-link" href="${e(img)}" target="_blank" rel="noopener">PDF 第 ${q.pages[i]} 页 ↗</a></p>`).join('')}</section></aside></div>`;
  }
  function years() {
    return `<header class="page-head"><span class="eyebrow">按年浏览</span><h1>从整套题看考试的结构。</h1><p class="page-intro">年份沿用汇编标注。每年列出原题顺序与原PDF页码，分值缺失或资料异常保留说明。</p></header>
      <div class="section-heading"><h2>近五年</h2><span class="muted">2021—2025 · 120 道题</span></div>${yearCards(db.coverage.filter(c=>c.included&&db.recent.includes(c.year)).reverse())}
      <div class="section-heading"><h2>较早的可用样本</h2><span class="muted">1999—2010 · 253 道题</span></div>${yearCards(db.coverage.filter(c=>c.included&&!db.recent.includes(c.year)).reverse())}
      <div class="notice"><span class="notice-symbol">i</span><p>2011—2020 年题卷自述为“依据回忆考点整理类似模拟题”，不列为主统计年份。原资料定位与剔除原因见<a href="#syllabus">资料说明</a>。当前未获得 2026 招生年份题卷。</p></div>`;
  }
  function yearCards(cs) {
    return `<div class="year-grid">${cs.map(c=>`<a class="year-card ${db.recent.includes(c.year)?'recent':''}" href="#year/${c.year}"><span class="eyebrow">${db.recent.includes(c.year)?'近五年':'早期样本'}</span><strong>${c.year}</strong><div class="year-info">${c.records} 道题 · ${db.questions.filter(q=>q.year===c.year&&q.type==='计算').length} 道计算</div><span class="chip ${c.material.includes('回忆')?'gold':'gray'}">${c.material.includes('回忆')?'回忆版':'汇编题卷'}</span></a>`).join('')}</div>`;
  }
  function yearDetail(year) {
    const c=db.coverage.find(c=>c.year===Number(year)&&c.included);
    if(!c) return empty('该年份不在主统计题库中','请从17个可用年份选择。','#years','返回年份目录');
    const items=db.questions.filter(q=>q.year===c.year);
    const sections=[...new Set(items.map(q=>q.section))];
    return `<div class="crumbs"><a href="#years">按年浏览</a><span>/</span><span>${c.year}</span></div><header class="page-head"><span class="eyebrow">${e(c.material)}</span><h1>${c.year} 年题目索引</h1><p class="page-intro">${c.records} 道原编号题 · ${items.filter(q=>q.type==='计算').length} 道计算题。下方保留原卷编号顺序。</p></header>
      <div class="notice"><span class="notice-symbol">i</span><p>${e(c.note||'来自现有题卷汇编，未独立核实为官方原卷。')}</p></div>
      ${Object.keys(c.section_scores).length?`<div class="score-grid">${Object.entries(c.section_scores).map(([s,score])=>`<div class="score-item">${e(s.replace('-','、'))}<b>${score}</b> 分</div>`).join('')}</div>`:'<p class="muted">这份资料未标注各题分值。</p>'}
      <p class="source-note">来源：${e(c.source)} · PDF 第 ${c.pages.join('、')} 页。分值按可见标注展示，未补齐或归一化。</p>
      ${sections.map(s=>`<h2 class="section-label">${e(s)}、${e(items.find(q=>q.section===s).type)}</h2>${qGrid(items.filter(q=>q.section===s))}`).join('')}
      <details class="ocr"><summary>连续查看本年原题扫描页（${c.pages.length} 页）</summary><div style="margin-top:18px">${scans(c.source,c.pages,c.pageImages)}</div></details>`;
  }
  function syllabus() {
    return `<header class="page-head"><span class="eyebrow">2027招生大纲 · 统计截至 2026.10.07</span><h1>重点的依据，和资料的边界。</h1><p class="page-intro">对照学院最新公告与文件夹中的大纲；考频来自逐题归类，不采用经验笔记中的“必考”判断。</p></header>
      <div class="syllabus-layout"><nav class="syllabus-nav" aria-label="说明目录"><a href="#syllabus" data-section="official">现行大纲</a><a href="#syllabus" data-section="method">统计方法</a><a href="#syllabus" data-section="coverage">资料覆盖与异常</a><a href="#syllabus" data-section="downloads">下载与补充资料</a></nav>
      <div class="syllabus-content"><section class="panel" id="official"><h2>现行大纲：先保证范围完整</h2><p>学院于2026-09-28发布2027年招生参考书目与考试大纲，标明830大纲无变化。本地大纲已与官方附件核对。参考书为李阳初《石油化学工程原理》上、下册（2008）。章节编号沿用原大纲：第一至六章、第八至十二章。</p><div class="detail-actions"><a class="btn btn-primary" href="${e(db.meta.syllabusUrl)}" target="_blank" rel="noopener">学院公告 ↗</a><a class="btn" href="${e(db.meta.syllabusDownload)}" target="_blank" rel="noopener">官方大纲附件 ↗</a></div>
      ${chapterNames.filter(ch=>db.topics.some(t=>t.chapter===ch&&!t.code.startsWith('O'))).map(ch=>`<h3>${e(ch)}</h3><div class="chapter-topics">${db.topics.filter(t=>t.chapter===ch&&!t.code.startsWith('O')).map(t=>`<a href="#topic/${e(t.code)}"><span><b>${e(t.name)}</b><br><small>${e(t.focus)}</small></span><small>${e(t.requirement)}<br>近五年 ${t.recent_years}/5</small></a>`).join('')}</div>`).join('')}
      <h3>现行大纲未列的历史内容</h3><p>热辐射、干燥与湿空气、压缩机及结晶等在历史资料中出现，已单列并降级。大纲补全项如流态化，近五年未见记录仍需按要求准备。</p><div class="q-tags">${db.topics.filter(t=>t.code.startsWith('O')).map(t=>chip(t.code)).join('')}</div></section>
      <section class="panel" id="method"><h2>统计方法：年数和题数各回答什么</h2><ul><li><b>出现年数</b>：一个知识点出现过的年份数。同年出现多题，只算一年；分母为主统计17年，近期分母为5年。</li><li><b>覆盖题数</b>：按原编号题统计，不拆分填空的多个空或计算题的小问。373道题中372道已归类；2024选择第3题残缺，保留为未判定。</li><li><b>计算出现年数</b>：知识点在计算题中出现过的年份数；不是该模块所有题型的年数。</li><li><b>一题多点</b>：只记录明确考查内容或必要计算环节。一题可同时对应多个考点，因此各知识点的题数有重叠。</li><li><b>版本去重</b>：同年多个版本只计一份。遮挡内容用其他版本交叉核对；数值差异保留说明，做题核对所展示的原页。</li><li><b>页码</b>：统一使用PDF查看器页码，不是书页上的印刷页码。题目展示整页扫描，保留公式、图示与来源标识。</li></ul><p>历史覆盖不能解释为下一次考试的命题概率。回忆题和汇编可能有缺题，未记录不能等同于从未考过。</p><p>整理方法参考了 GitHub 上的 <a class="text-link" href="https://github.com/GeniusTrader-Harry/past-paper-topic-analyzer" target="_blank" rel="noopener">past-paper-topic-analyzer</a>：归纳考点、保留题号来源、与大纲核对。本题库的分类与异常记录经过逐题校核。</p></section>
      <section class="panel" id="coverage"><h2>资料覆盖与异常</h2><p>主统计为1999—2010、2021—2025共17年。2010、2021为回忆版；其余为现有题卷汇编，未独立核实为官方原卷。2011—2020的汇编自述为依据回忆考点整理类似模拟题，排除出主考频。</p><div class="table-scroll"><table class="coverage-table"><thead><tr><th>年份</th><th>题数</th><th>主统计</th><th>PDF页码</th><th>材料说明</th></tr></thead><tbody>${db.coverage.map(c=>`<tr><td>${c.included?`<a class="text-link" href="#year/${c.year}">${c.year}</a>`:c.year}</td><td>${c.records??'—'}</td><td>${c.included?'纳入':'剔除'}</td><td>${c.pages.join('、')}</td><td>${e(c.material)}${c.note?'；'+e(c.note):''}<br><small>${e(c.source)}</small></td></tr>`).join('')}</tbody></table></div><h3>近期分值与版本说明</h3><ul><li>2021：分项标注40+20+100=160分，合计异常。</li><li>2022：分项合计150分，但不同汇编存在个别题干数值差异。</li><li>2023：填空40、简答50、计算60分；四道计算没有分别标分，不按平均数补造。</li><li>2024：未标分值，部分题干残缺。</li><li>2025：可见分值合计140分，存在10分缺口，未补齐。</li></ul><p>因此本次以题型、题数和出现年份判断重点，没有给出不可靠的分值占比。</p></section>
      <section class="panel" id="downloads"><h2>下载与后续补充</h2><div class="detail-actions"><a class="btn" href="downloads/830-review.xlsx" download>↓ 考频与题目索引 Excel</a><a class="btn" href="downloads/830-review.md" download>↓ 复习重点解读</a></div><p>最有价值的补充是<b>2026招生年份的题卷</b>，其次是可核对的官方原卷或清晰回忆稿、2024残缺题干和缺失分值。这些可以更新题库和近期趋势。</p><p>收藏和个人笔记保存在当前浏览器，不跨设备同步。可在收藏页导出备份并在另一设备导入；本站未补造标准答案。</p><p><a class="text-link" href="${e(db.meta.repository)}" target="_blank" rel="noopener">查看 GitHub 项目 ↗</a></p></section></div></div>`;
  }
  function saved(params) {
    const withNotes=params.get('notes')==='1';
    const source=db.questions.filter(q=>isSaved(q.id)||(withNotes&&personal.notes[q.id]));
    const items=filterQuestions(params,source);
    return `<header class="page-head"><span class="eyebrow">我的收藏</span><h1>把需要再练的题留在这里。</h1><p class="page-intro">收藏和笔记保存在当前浏览器。导出文件可用于备份，也可以在另一台设备导入继续使用。</p></header><div class="saved-toolbar"><button class="btn" type="button" data-export>↓ 导出收藏与笔记</button><button class="btn" type="button" data-import>↑ 导入备份</button><input type="file" id="backup-file" accept="application/json,.json" hidden><a class="btn ${withNotes?'btn-primary':''}" href="${e(link('saved',{...Object.fromEntries(params),notes:withNotes?'':1,page:''}))}">${withNotes?'✓ 包含有笔记的题目':'同时显示有笔记的题目'}</a></div>${questionFilters(params,'saved')}
      <div class="results-line"><span data-result-count="${items.length}"><strong>${items.length}</strong> 道题 · 共 ${personal.saved.length} 道收藏，${Object.keys(personal.notes).length} 道有笔记</span><a class="text-link" href="#saved">重置筛选</a></div>${items.length?qGrid(pageItems(items,params),{notes:true,query:params.get('q')}):empty('这里还没有对应题目','在题目卡片上点击星号即可收藏，或到题目详情记录笔记。','#questions','去题库挑选')}${pager(items.length,params,'saved')}`;
  }
  function render() {
    const {parts,params}=route();
    const [name,id]=parts;
    const renderers={home,topics:()=>topicCatalog(params),topic:()=>topicDetail(id),questions:()=>library(params),question:()=>questionDetail(id),years,year:()=>yearDetail(id),syllabus,saved:()=>saved(params)};
    main.innerHTML=(renderers[name]||(()=>empty('页面不存在','从导航栏选择题库或知识点即可继续。','#home','返回首页')))();
    const active=({topic:'topics',question:'questions',year:'years'})[name]||name;
    for (const a of document.querySelectorAll('.header [data-nav]')) {a.classList.toggle('active',a.dataset.nav===active);if(a.dataset.nav===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    document.getElementById('saved-count').textContent=personal.saved.length;
    const title=name==='question'&&byId.has(id)?byId.get(id).title:name==='topic'&&topics.has(id)?topics.get(id).name:name==='year'?id+'年题目':({home:'考点与题库',topics:'知识点',questions:'题库',years:'按年浏览',syllabus:'大纲与资料说明',saved:'我的收藏'})[name]||'考点与题库';
    document.title=title+' · 830 化工原理';
    window.scrollTo({top:0,behavior:'instant'});
  }
  function persist() {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(personal));return true;}
    catch(_){toast('浏览器未允许本地保存，请导出备份。');return false;}
  }
  let toastTimer;
  function toast(msg) {
    const box=document.getElementById('toast');box.textContent=msg;box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),2600);
  }
  document.addEventListener('submit',event=>{
    const form=event.target.closest('[data-search]');
    if(!form)return;
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    if(form.dataset.search==='saved'&&route().params.get('notes')==='1')values.notes=1;
    const hash=link(form.dataset.search,values);
    if(location.hash===hash)render();else location.hash=hash;
  });
  document.addEventListener('change',event=>{
    const form=event.target.closest('[data-search]');
    if(form&&(event.target.tagName==='SELECT'||event.target.type==='checkbox'))form.requestSubmit();
  });
  document.addEventListener('click',async event=>{
    const target=event.target.closest('button,a,img');
    if(!target)return;
    if(target.classList.contains('skip-link')){event.preventDefault();main.focus();main.scrollIntoView();return;}
    if(target.dataset.section){event.preventDefault();document.getElementById(target.dataset.section)?.scrollIntoView({behavior:'smooth'});return;}
    if(target.hasAttribute('data-bookmark')){
      const id=target.dataset.bookmark;
      if(!byId.has(id))return;
      personal.saved=isSaved(id)?personal.saved.filter(x=>x!==id):[...personal.saved,id];
      const stored=persist();
      for(const b of document.querySelectorAll('[data-bookmark]'))if(b.dataset.bookmark===id){
        b.classList.toggle('saved',isSaved(id));b.setAttribute('aria-pressed',isSaved(id));
        if(b.classList.contains('bookmark')){b.textContent=isSaved(id)?'★':'☆';b.setAttribute('aria-label',(isSaved(id)?'取消收藏':'收藏')+'：'+byId.get(id).title);b.title=isSaved(id)?'取消收藏':'收藏这道题';}
        else{b.classList.toggle('btn-primary',isSaved(id));b.textContent=isSaved(id)?'★ 已收藏':'☆ 收藏这道题';}
      }
      document.getElementById('saved-count').textContent=personal.saved.length;
      if(route().parts[0]==='saved'){const y=scrollY;render();window.scrollTo({top:y,behavior:'instant'});}
      if(stored)toast(isSaved(id)?'已加入收藏':'已取消收藏');return;
    }
    if(target.hasAttribute('data-zoom')){
      document.getElementById('scan-zoom').src=target.dataset.zoom;
      document.getElementById('scan-title').textContent=target.dataset.caption;
      document.getElementById('scan-dialog').showModal();
      document.querySelector('.zoom-scroll').scrollTo(0,0);return;
    }
    if(target.id==='scan-close'){document.getElementById('scan-dialog').close();return;}
    if(target.hasAttribute('data-save-note')){
      const id=target.dataset.saveNote;const val=document.getElementById('question-note').value.trim();
      if(val)personal.notes[id]=val;else delete personal.notes[id];
      if(persist()){document.getElementById('note-status').textContent=' 已保存';toast(val?'笔记已保存':'已清除这道题的笔记');}return;
    }
    if(target.hasAttribute('data-copy')){
      try{await navigator.clipboard.writeText(location.href);toast('题目链接已复制');}
      catch(_){toast('可直接复制浏览器地址分享这道题。');}return;
    }
    if(target.hasAttribute('data-export')){
      const blob=new Blob([JSON.stringify({format:'cup830-review-v1',exported:new Date().toISOString(),...personal},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='830-收藏与笔记-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;
    }
    if(target.hasAttribute('data-import'))document.getElementById('backup-file').click();
  });
  document.addEventListener('change',async event=>{
    if(event.target.id!=='backup-file')return;
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>2000000){toast('文件过大，请选择本站导出的备份。');return;}
    try{
      const v=JSON.parse(await file.text());
      if(v.format!=='cup830-review-v1')throw new Error('unknown format');
      const imported=sanitizePersonal(v);
      personal={saved:[...new Set([...personal.saved,...imported.saved])],notes:{...personal.notes,...imported.notes}};
      persist();render();toast('收藏与笔记已合并导入');
    }catch(_){toast('无法读取备份，请选择本站导出的 JSON 文件。');}
  });
  document.getElementById('scan-dialog').addEventListener('click',event=>{if(event.target.id==='scan-dialog')event.target.close();});
  window.addEventListener('hashchange',render);
  render();
})();
