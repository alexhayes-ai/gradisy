/* Gradisy · phiên bản 1
 * Trang một tệp: hồ sơ, việc đã làm, Góc ngành, kết nối.
 * Có config.js => chạy thật với Supabase. Không có => chế độ mẫu (dữ liệu giả trong bộ nhớ).
 * Mọi nội dung người dùng đều được gắn bằng textContent để chống chèn mã độc. */
(() => {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const APP = CFG.APP_NAME || 'Gradisy';

  const INDUSTRIES = { 'thiet-ke': 'Thiết kế', 'quang-cao': 'Quảng cáo', 'noi-dung': 'Sáng tạo nội dung', 'khac': 'Ngành khác' };
  const CORNER = ['thiet-ke', 'quang-cao']; // Góc ngành đang mở
  const LEVELS = [
    [1, 'Hỏi đáp', 'Bạn hỏi, AI trả lời'],
    [2, 'Làm cùng', 'AI làm trong file, công cụ của bạn'],
    [3, 'Có duyệt', 'AI làm nhiều bước, xin duyệt từng bước'],
    [4, 'Giao trọn', 'AI làm xong, bạn kiểm tra'],
    [5, 'Quy trình', 'Mẫu, quy tắc, skill riêng'],
    [6, 'Chủ động', 'AI tự chạy nền, theo giờ'],
    [7, 'Điều phối', 'Quản lý cả đội AI']
  ];
  const LIMITS = { display_name: 60, headline: 120, ai_tools: 80, style: 400, title: 120, problem: 600, ai_used: 120, evidence_url: 500, result: 800, saved: 200, lesson: 800, worry: 500 };

  // ---------- Tiện ích giao diện ----------
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
    return n;
  }
  const view = document.getElementById('view');
  // Gắn nội dung vào trang, bỏ qua phần trống (null/false) để không hiện chữ "null".
  const render = (...nodes) => view.replaceChildren(...nodes.flat().filter(n => n != null && n !== false));
  const toastEl = document.getElementById('toast');
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800); }
  const initials = name => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const levelName = n => { const l = LEVELS[(n || 1) - 1]; return l ? `Cấp ${l[0]}/7 · ${l[1]}` : ''; };
  const fmtDate = s => { try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return ''; } };
  const isHttps = u => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);
  function errorCard(e) {
    console.error(e);
    return el('section', { class: 'card pad' }, el('b', { text: 'Không tải được dữ liệu.' }), el('p', { class: 'sub', text: 'Kiểm tra mạng rồi tải lại trang.' }));
  }

  // ---------- Lớp dữ liệu: Supabase thật ----------
  function liveApi() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
    const chk = ({ data, error, count }) => { if (error) throw error; return count ?? data; };
    // Ghi rõ đường nối works.user_id -> profiles (có 2 đường nối, phải chỉ đích danh).
    const AUTHOR = 'profiles!works_user_id_fkey(id,display_name,industry,ai_level)';
    return {
      async session() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
      onAuth(fn) { sb.auth.onAuthStateChange((_e, s) => fn(s?.user || null)); },
      signIn() { return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); },
      signOut() { return sb.auth.signOut(); },
      feed: () => sb.from('works').select('*,' + AUTHOR).order('created_at', { ascending: false }).limit(30).then(chk),
      newPeople: () => sb.from('profiles').select('id,display_name,headline,industry,ai_level').order('created_at', { ascending: false }).limit(12).then(chk),
      peopleIn: ind => sb.from('profiles').select('id,display_name,headline,industry,ai_level').eq('industry', ind).order('updated_at', { ascending: false }).limit(60).then(chk),
      profile: id => sb.from('profiles').select('*').eq('id', id).maybeSingle().then(chk),
      worksOf: id => sb.from('works').select('*,' + AUTHOR).eq('user_id', id).order('created_at', { ascending: false }).then(chk),
      tried: ids => ids.length ? sb.from('tried').select('work_id,user_id,worked').in('work_id', ids).then(chk) : Promise.resolve([]),
      followers: id => sb.from('connections').select('follower', { count: 'exact', head: true }).eq('following', id).then(chk),
      isConnected: (me, id) => sb.from('connections').select('following').eq('follower', me).eq('following', id).maybeSingle().then(r => !!chk(r)),
      connect: (me, id, on) => (on ? sb.from('connections').insert({ follower: me, following: id }) : sb.from('connections').delete().eq('follower', me).eq('following', id)).then(chk),
      saveProfile: (me, p) => sb.from('profiles').upsert({ ...p, id: me, updated_at: new Date().toISOString() }).then(chk),
      deleteProfile: me => sb.from('profiles').delete().eq('id', me).then(chk),
      addWork: (me, w) => sb.from('works').insert({ ...w, user_id: me }).then(chk),
      deleteWork: id => sb.from('works').delete().eq('id', id).then(chk),
      worries: ind => sb.from('worries').select('*,profiles!worries_user_id_fkey(id,display_name)').eq('industry', ind).order('created_at', { ascending: false }).limit(50).then(chk),
      addWorry: (me, ind, body) => sb.from('worries').insert({ user_id: me, industry: ind, body }).then(chk),
      deleteWorry: id => sb.from('worries').delete().eq('id', id).then(chk),
      markTried: (me, workId, worked) => sb.from('tried').upsert({ user_id: me, work_id: workId, worked }).then(chk),
      unmarkTried: (me, workId) => sb.from('tried').delete().eq('user_id', me).eq('work_id', workId).then(chk),
      report: (me, type, id) => sb.from('reports').insert({ reporter: me, target_type: type, target_id: id }).then(chk),
      isAdmin: me => sb.from('admins').select('user_id').eq('user_id', me).maybeSingle().then(r => !!chk(r)).catch(() => false),
      docs: () => sb.from('docs').select('id,title,summary,topic,link,created_at').order('created_at', { ascending: false }).limit(200).then(chk),
      doc: id => sb.from('docs').select('*').eq('id', id).maybeSingle().then(chk),
      saveDoc: (me, d, id) => (id ? sb.from('docs').update({ ...d, updated_at: new Date().toISOString() }).eq('id', id) : sb.from('docs').insert({ ...d, author: me })).then(chk),
      deleteDoc: id => sb.from('docs').delete().eq('id', id).then(chk)
    };
  }

  // ---------- Lớp dữ liệu: chế độ mẫu (chỉ trong bộ nhớ) ----------
  function demoApi() {
    const now = Date.now(), day = 864e5;
    const P = [
      { id: 'mau-sir', display_name: 'Sir (hồ sơ mẫu)', headline: 'Học AI từ số 0 và làm công khai trên YouTube', industry: 'noi-dung', ai_level: 5, ai_tools: 'Claude, Claude Code', style: 'Nói kết luận trước, lý do sau.\nPhản biện thẳng: ưu, nhược điểm, rủi ro.\nGiải thích đơn giản, tránh thuật ngữ.', created_at: new Date(now - 3 * day).toISOString(), updated_at: new Date(now - day).toISOString() },
      { id: 'mau-designer', display_name: 'Hồ sơ ví dụ (không có thật)', headline: 'Ví dụ một designer, để xem thử Góc ngành', industry: 'thiet-ke', ai_level: 3, ai_tools: 'ChatGPT', style: '', created_at: new Date(now - 2 * day).toISOString(), updated_at: new Date(now - 2 * day).toISOString() }
    ];
    const W = [
      { id: 'w1', user_id: 'mau-sir', title: 'Tự động tổng hợp kiến thức học mỗi ngày', problem: 'Đọc nhiều link, chụp ảnh, ghi chú thô mỗi ngày trong Google Doc, dễ rời rạc và quên.', ai_used: 'Claude Code + kết nối Google Docs', evidence_url: null, result: 'Lúc 17:00 Claude đọc ghi chú của ngày, viết phần Tổng hợp (đã học, chưa được, việc tiếp, ý cho nội dung) và cập nhật Nhật ký học, Kho kiến thức.', saved: '', lesson: 'Chỉ thêm, không xoá ghi chú gốc. Mỗi ý gắn nhãn: đã xác minh, theo ghi chú, ý riêng, chưa xác minh.', created_at: new Date(now - day).toISOString() },
      { id: 'w2', user_id: 'mau-sir', title: 'Bot đăng bài mỗi ngày', problem: 'Muốn đăng đều mỗi ngày nhưng không đủ thời gian tự viết và tự đăng.', ai_used: 'Claude (soạn bài) + chương trình Python nhỏ', evidence_url: null, result: '19:00 Claude soạn bài theo khung BAB, 8:00 sáng hôm sau bot tự đăng lên LinkedIn và Threads.', saved: '', lesson: 'Luôn có nút an toàn: chạy thử trước, file STOP để dừng ngay.', created_at: new Date(now - 2 * day).toISOString() },
      { id: 'w3', user_id: 'mau-designer', title: 'Ví dụ: làm nhanh phương án ảnh quảng cáo', problem: 'Ví dụ minh hoạ: khách cần nhiều phương án trong thời gian ngắn.', ai_used: 'ChatGPT', evidence_url: 'https://example.com', result: 'Ví dụ minh hoạ: AI tạo phương án, designer chọn và chỉnh tay.', saved: 'Ví dụ: 2 ngày còn nửa ngày', lesson: 'Ví dụ: chất riêng nằm ở bước chọn và chỉnh tay.', created_at: new Date(now - 3 * day).toISOString() }
    ];
    const C = [], T = [{ user_id: 'mau-designer', work_id: 'w1', worked: true }];
    const R = [{ id: 'r1', user_id: 'mau-designer', industry: 'thiet-ke', body: 'Ví dụ: Tôi lo khách hàng sẽ tự dùng AI thay vì thuê designer.', created_at: new Date(now - day).toISOString() }];
    const D = [{ id: 'd1', author: 'mau-sir', title: 'Ví dụ: Bắt đầu với Claude trong 15 phút', summary: 'Tài liệu mẫu để xem thử giao diện.', topic: 'Nhập môn', link: null, body: 'Đây là nội dung ví dụ.\n\n1. Tạo tài khoản.\n2. Hỏi câu đầu tiên.\n3. Ghi lại điều học được.', created_at: new Date(now - day).toISOString() }];
    let user = null, authFn = () => {};
    const ok = v => Promise.resolve(JSON.parse(JSON.stringify(v)));
    const withAuthor = w => ({ ...w, profiles: P.find(p => p.id === w.user_id) || null });
    const byNew = (a, b) => b.created_at.localeCompare(a.created_at);
    return {
      session: () => ok(user),
      onAuth(fn) { authFn = fn; },
      signIn() { user = { id: 'mau-ban' }; authFn(user); return ok(null); },
      signOut() { user = null; authFn(null); return ok(null); },
      feed: () => ok(W.slice().sort(byNew).map(withAuthor)),
      newPeople: () => ok(P.slice().sort(byNew)),
      peopleIn: ind => ok(P.filter(p => p.industry === ind)),
      profile: id => ok(P.find(p => p.id === id) || null),
      worksOf: id => ok(W.filter(w => w.user_id === id).sort(byNew).map(withAuthor)),
      tried: ids => ok(T.filter(t => ids.includes(t.work_id))),
      followers: id => ok(C.filter(c => c.following === id).length),
      isConnected: (me, id) => ok(C.some(c => c.follower === me && c.following === id)),
      connect(me, id, on) { const i = C.findIndex(c => c.follower === me && c.following === id); if (on && i < 0) C.push({ follower: me, following: id }); if (!on && i >= 0) C.splice(i, 1); return ok(null); },
      saveProfile(me, p) { const i = P.findIndex(x => x.id === me); const row = { ...(P[i] || { created_at: new Date().toISOString() }), ...p, id: me, updated_at: new Date().toISOString() }; if (i >= 0) P[i] = row; else P.push(row); return ok(null); },
      deleteProfile(me) { const i = P.findIndex(x => x.id === me); if (i >= 0) P.splice(i, 1); for (let j = W.length - 1; j >= 0; j--) if (W[j].user_id === me) W.splice(j, 1); return ok(null); },
      addWork(me, w) { W.push({ ...w, id: 'w' + Math.random().toString(36).slice(2), user_id: me, created_at: new Date().toISOString() }); return ok(null); },
      deleteWork(id) { const i = W.findIndex(w => w.id === id); if (i >= 0) W.splice(i, 1); return ok(null); },
      worries: ind => ok(R.filter(r => r.industry === ind).sort(byNew).map(r => ({ ...r, profiles: P.find(p => p.id === r.user_id) || null }))),
      addWorry(me, ind, body) { R.push({ id: 'r' + Math.random().toString(36).slice(2), user_id: me, industry: ind, body, created_at: new Date().toISOString() }); return ok(null); },
      deleteWorry(id) { const i = R.findIndex(r => r.id === id); if (i >= 0) R.splice(i, 1); return ok(null); },
      markTried(me, workId, worked) { const t = T.find(x => x.user_id === me && x.work_id === workId); if (t) t.worked = worked; else T.push({ user_id: me, work_id: workId, worked }); return ok(null); },
      unmarkTried(me, workId) { const i = T.findIndex(x => x.user_id === me && x.work_id === workId); if (i >= 0) T.splice(i, 1); return ok(null); },
      report: () => ok(null),
      isAdmin: () => ok(!!user),
      docs: () => ok(D.slice().sort(byNew)),
      doc: id => ok(D.find(d => d.id === id) || null),
      saveDoc(me, d, id) { const i = D.findIndex(x => x.id === id); if (i >= 0) D[i] = { ...D[i], ...d }; else D.push({ ...d, id: 'd' + Math.random().toString(36).slice(2), author: me, created_at: new Date().toISOString() }); return ok(null); },
      deleteDoc(id) { const i = D.findIndex(d => d.id === id); if (i >= 0) D.splice(i, 1); return ok(null); }
    };
  }

  const api = LIVE ? liveApi() : demoApi();
  const state = { user: null, me: null, isAdmin: false };
  let renderToken = 0;

  // ---------- Đăng nhập ----------
  async function loadMe() {
    state.me = state.user ? await api.profile(state.user.id).catch(() => null) : null;
    state.isAdmin = state.user ? await api.isAdmin(state.user.id) : false;
  }
  async function signIn() {
    try { await api.signIn(); } catch (e) { console.error(e); toast('Chưa đăng nhập được. Thử lại sau.'); }
  }
  function needLogin(msg) {
    if (state.user && state.me) return false;
    if (!state.user) { toast(msg || 'Hãy đăng nhập bằng Google trước.'); signIn(); }
    else { toast('Hãy tạo hồ sơ trước.'); location.hash = '#/toi'; }
    return true;
  }
  function renderWho() {
    const who = document.getElementById('who');
    who.replaceChildren();
    if (!state.user) {
      who.append(el('button', { class: 'btn primary small', type: 'button', onclick: signIn }, 'Đăng nhập'));
      return;
    }
    if (state.me) {
      who.append(
        el('a', { class: 'btn small hide-sm', href: '#/dang' }, 'Đăng việc'),
        el('a', { class: 'av', href: '#/nguoi/' + state.me.id, title: 'Hồ sơ của tôi', style: 'width:34px;height:34px;font-size:13px;text-decoration:none' }, initials(state.me.display_name))
      );
    } else {
      who.append(el('a', { class: 'btn small', href: '#/toi' }, 'Tạo hồ sơ'));
    }
    who.append(el('button', { class: 'link-btn signout', type: 'button', onclick: doSignOut }, 'Đăng xuất'));
  }
  async function doSignOut() { await api.signOut(); toast('Đã đăng xuất.'); location.hash = '#/'; }

  // ---------- Thành phần dùng chung ----------
  function personCard(p) {
    return el('a', { class: 'card person', href: '#/nguoi/' + p.id },
      el('span', { class: 'av' }, initials(p.display_name)),
      el('span', { class: 'person-txt' },
        el('b', { text: p.display_name }),
        el('span', { text: `${INDUSTRIES[p.industry] || ''} · ${levelName(p.ai_level)}` })
      ));
  }

  function aiPrompt(w, author) {
    const lines = [
      'Mình muốn học cách làm việc dưới đây từ một người đã dùng AI để làm. Bạn hãy:',
      '1. Giải thích ngắn gọn, dễ hiểu họ đã làm thế nào.',
      '2. Hỏi mình đang làm nghề gì và gặp vấn đề gì, để gợi ý cách áp dụng cho mình.',
      'Chỉ dựa trên thông tin dưới đây, không bịa thêm số liệu. Chỗ nào thiếu thì nói là thiếu.',
      '',
      `Người làm: ${author?.display_name || 'không rõ'} (${INDUSTRIES[author?.industry] || 'không rõ ngành'}, ${levelName(author?.ai_level)})`,
      `Việc: ${w.title}`,
      `Vấn đề: ${w.problem}`,
      `AI đã dùng: ${w.ai_used}`,
      `Kết quả: ${w.result}`,
      `Tiết kiệm được: ${w.saved || 'chưa ghi'}`,
      `Bài học, cách làm lại: ${w.lesson}`,
      w.evidence_url ? `Bằng chứng: ${w.evidence_url}` : 'Bằng chứng: chưa có',
      `Nguồn: ${location.origin}${location.pathname}#/nguoi/${w.user_id}`
    ];
    return lines.join('\n');
  }

  async function copyText(text, holder) {
    try { await navigator.clipboard.writeText(text); toast('Đã chép. Dán vào ChatGPT, Gemini hoặc Claude của bạn rồi hỏi tiếp.'); }
    catch {
      const ta = el('textarea', { rows: '6', readonly: true, style: 'width:100%;margin-top:10px' });
      ta.value = text; holder.append(ta); ta.focus(); ta.select();
      toast('Máy chưa cho chép tự động. Đoạn đã được bôi đen, bấm Ctrl+C để chép.');
    }
  }

  function workCard(w, tried, opts = {}) {
    const author = w.profiles;
    const mine = state.user && w.user_id === state.user.id;
    const ok = tried.filter(t => t.work_id === w.id && t.worked).length;
    const notOk = tried.filter(t => t.work_id === w.id && !t.worked).length;
    const myMark = state.user ? tried.find(t => t.work_id === w.id && t.user_id === state.user.id) : null;
    const hasProof = isHttps(w.evidence_url);
    const box = el('article', { class: 'work' });
    const actions = el('div', { class: 'work-actions' });

    actions.append(el('button', { class: 'btn primary small', type: 'button', onclick: () => copyText(aiPrompt(w, author), box) }, 'Hỏi AI của bạn về cách làm này'));
    if (!mine) {
      const mark = async worked => {
        if (needLogin('Đăng nhập để đánh dấu đã làm theo.')) return;
        try {
          if (myMark && myMark.worked === worked) await api.unmarkTried(state.user.id, w.id);
          else await api.markTried(state.user.id, w.id, worked);
          route();
        } catch (e) { console.error(e); toast('Chưa lưu được. Thử lại.'); }
      };
      actions.append(
        el('button', { class: 'btn small' + (myMark?.worked === true ? '' : ' ghost'), type: 'button', onclick: () => mark(true) }, 'Tôi làm theo: hiệu quả'),
        el('button', { class: 'btn small' + (myMark?.worked === false ? '' : ' ghost'), type: 'button', onclick: () => mark(false) }, 'Chưa hiệu quả')
      );
    }
    actions.append(el('span', { class: 'tried-count', text: `${ok} người làm theo thành công${notOk ? ` · ${notOk} chưa được` : ''}` }));
    if (mine) {
      let armed = false;
      const del = el('button', { class: 'link-btn', type: 'button', onclick: async () => {
        if (!armed) { armed = true; del.textContent = 'Bấm lần nữa để xoá'; return; }
        try { await api.deleteWork(w.id); toast('Đã xoá.'); route(); } catch (e) { console.error(e); toast('Chưa xoá được.'); }
      } }, 'Xoá việc này');
      actions.append(del);
    } else {
      actions.append(el('button', { class: 'link-btn', type: 'button', onclick: async () => {
        if (needLogin('Đăng nhập để báo cáo.')) return;
        try { await api.report(state.user.id, 'work', w.id); toast('Đã gửi báo cáo. Cảm ơn bạn.'); } catch (e) { console.error(e); toast('Chưa gửi được.'); }
      } }, 'Báo cáo'));
    }

    const dl = el('dl', null,
      el('dt', { text: 'Vấn đề' }), el('dd', { text: w.problem }),
      el('dt', { text: 'AI đã dùng' }), el('dd', { text: w.ai_used }),
      el('dt', { text: 'Bằng chứng' }), el('dd', null, hasProof ? el('a', { href: w.evidence_url, target: '_blank', rel: 'noopener noreferrer nofollow', text: w.evidence_url }) : 'Chưa có'),
      el('dt', { text: 'Kết quả' }), el('dd', { text: w.result }),
      el('dt', { text: 'Tiết kiệm' }), el('dd', { text: w.saved || 'Chưa ghi' }),
      el('dt', { text: 'Bài học' }), el('dd', { text: w.lesson })
    );
    box.append(
      el('div', { class: 'work-top' },
        el('div', null,
          el('h3', { text: w.title }),
          opts.showAuthor && author ? el('a', { class: 'by', href: '#/nguoi/' + author.id, text: `${author.display_name} · ${INDUSTRIES[author.industry] || ''} · ${fmtDate(w.created_at)}` }) : el('span', { class: 'by', text: fmtDate(w.created_at) })
        ),
        el('span', { class: 'proof' + (hasProof ? ' yes' : ''), text: hasProof ? 'Có bằng chứng' : 'Chưa có bằng chứng' })
      ),
      el('p', { class: 'problem', text: w.result }),
      el('details', null, el('summary', { text: 'Xem cách làm' }), dl),
      actions
    );
    return box;
  }

  function levelLadder(n) {
    return el('div', { class: 'levels' }, LEVELS.map(([i, name, desc]) =>
      el('div', { class: 'lv' + (i < n ? ' done' : i === n ? ' now' : '') }, el('div', { class: 'bar' }), el('b', { text: `${i} · ${name}` }), el('span', { text: desc }))));
  }

  // ---------- Các trang ----------
  // Biểu tượng nét mảnh (SVG phải tạo bằng createElementNS mới hiển thị).
  function icon(...paths) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) s.setAttribute(k, v);
    for (const d of paths) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p); }
    return s;
  }
  const ICONS = {
    profile: ['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M2.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5', 'M16 7h5M16 11h5M16 15h3'],
    proof: ['M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z', 'M8.5 12l2.5 2.5 4.5-5'],
    connect: ['M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M9.5 7.5l5 8'],
    learn: ['M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0V5.5z', 'M12 5.5V19']
  };

  function heroCta() {
    if (!state.user) return el('button', { class: 'btn primary lg', type: 'button', onclick: signIn }, 'Tạo hồ sơ miễn phí');
    if (!state.me) return el('a', { class: 'btn primary lg', href: '#/toi' }, 'Hoàn thiện hồ sơ của bạn');
    return el('a', { class: 'btn primary lg', href: '#/nguoi/' + state.me.id }, 'Xem hồ sơ của bạn');
  }

  // Thẻ minh hoạ một hồ sơ (ghi rõ là ví dụ, không phải người thật).
  function previewCard() {
    return el('div', { class: 'preview', 'aria-hidden': 'true' },
      el('div', { class: 'preview-top' },
        el('div', { class: 'pair' }, el('span', { class: 'av' }, 'B'), el('span', { class: 'av ai' }, 'AI')),
        el('span', { class: 'preview-tag', text: 'Hồ sơ ví dụ' })),
      el('b', { class: 'preview-name', text: 'Bạn & AI đồng hành' }),
      el('span', { class: 'preview-sub', text: 'Thiết kế · Cấp 5/7 · Quy trình' }),
      el('div', { class: 'preview-bars' }, [1, 2, 3, 4, 5, 6, 7].map(i => el('i', { class: i <= 5 ? 'on' : '' }))),
      el('div', { class: 'preview-work' },
        el('span', { class: 'proof yes', text: 'Có bằng chứng' }),
        el('b', { text: 'Làm 20 phương án ảnh quảng cáo trong 1 buổi' }),
        el('span', { text: 'AI tạo phương án · bạn chọn và chỉnh tay' })),
      el('div', { class: 'preview-foot' }, el('span', null, el('b', { text: '3' }), ' việc đã làm'), el('span', null, el('b', { text: '12' }), ' lượt làm theo')));
  }

  async function pageHome(t) {
    const hero = el('section', { class: 'hero2' },
      el('div', { class: 'hero-copy' },
        el('span', { class: 'eyebrow', text: 'Nơi đồng hành cùng AI' }),
        el('h1', { class: 'serif', text: 'Cho thế giới thấy bạn và AI của bạn làm được gì' }),
        el('p', { class: 'lead', text: 'Gradisy là nơi bạn xây hồ sơ năng lực cho cả bạn và AI đồng hành, chia sẻ những việc thật đã làm cùng AI, và kết nối với những người đang sống, làm việc cùng AI mỗi ngày.' }),
        el('div', { class: 'row' }, heroCta(), el('a', { class: 'btn lg', href: '#/nganh' }, 'Khám phá cộng đồng')),
        el('ul', { class: 'trust' },
          el('li', { text: 'Miễn phí' }),
          el('li', { text: 'Đăng nhập bằng Google' }),
          el('li', { text: 'Bạn quyết định chia sẻ gì' }))),
      previewCard());

    const value = (ic, title, text) => el('div', { class: 'value' }, el('span', { class: 'value-ic' }, icon(...ICONS[ic])), el('h3', { text: title }), el('p', { text: text }));
    const values = el('section', { class: 'block' },
      el('div', { class: 'block-head' },
        el('span', { class: 'eyebrow', text: 'Gradisy giúp bạn' }),
        el('h2', { class: 'serif', text: 'Một nơi cho cả bạn và AI của bạn' })),
      el('div', { class: 'values' },
        value('profile', 'Hồ sơ năng lực cùng AI', 'Giống CV hay LinkedIn, nhưng cho thấy cả cách bạn làm việc với AI: AI bạn dùng, phong cách làm việc, cấp độ dùng AI.'),
        value('proof', 'Khoe việc thật, có bằng chứng', 'Mỗi việc ghi rõ vấn đề, cách làm, kết quả và bài học. Có link bằng chứng thì được gắn nhãn xác nhận.'),
        value('connect', 'Kết nối đúng người', 'Tìm người cùng nghề đã đi trước, kết nối và xem họ làm việc cùng AI như thế nào.'),
        value('learn', 'Học và đồng hành', 'Tài liệu học chọn lọc, cùng một nút mang mọi cách làm sang AI của bạn để học tiếp.')));

    const mission = el('section', { class: 'mission' },
      el('span', { class: 'eyebrow', text: 'Sứ mệnh' }),
      el('h2', { class: 'serif', text: 'Một thế giới mà ai cũng dùng được AI.' }),
      el('p', { text: 'Gradisy muốn mỗi người đều có thể coi AI như một trợ lý đắc lực của mình: giúp làm việc nhanh hơn, học điều mới dễ hơn và có thêm thời gian cho những việc quan trọng. Khi thấy những việc thật người khác đã làm cùng AI, bạn sẽ biết mình có thể bắt đầu từ đâu.' }));

    const step = (n, title, text) => el('div', { class: 'how-step' }, el('span', { class: 'how-n', text: String(n) }), el('h3', { text: title }), el('p', { text: text }));
    const how = el('section', { class: 'block' },
      el('div', { class: 'block-head' },
        el('span', { class: 'eyebrow', text: 'Bắt đầu trong vài phút' }),
        el('h2', { class: 'serif', text: 'Cách Gradisy hoạt động' })),
      el('div', { class: 'how' },
        step(1, 'Tạo hồ sơ', 'Đăng nhập bằng Google, giới thiệu bạn và AI đồng hành của bạn.'),
        step(2, 'Chia sẻ việc đã làm', 'Đăng những việc thật bạn làm cùng AI, kèm cách làm và bằng chứng.'),
        step(3, 'Kết nối và học hỏi', 'Theo dõi người cùng nghề, làm theo cách hay, học từ tài liệu chọn lọc.')));

    const cta = el('section', { class: 'cta-band' },
      el('div', null, el('h2', { class: 'serif', text: 'Bắt đầu hồ sơ của bạn trên Gradisy' }), el('p', { text: 'Miễn phí, chỉ mất một phút với tài khoản Google.' })),
      heroCta());

    const top = [hero, values, mission, how];
    render(...top, el('p', { class: 'sub', text: 'Đang tải hoạt động mới...' }), cta);
    try {
      const [works, people, docs] = await Promise.all([api.feed(), api.newPeople(), api.docs().catch(() => [])]);
      const tried = await api.tried(works.map(w => w.id));
      if (t !== renderToken) return;
      const head = (title, link, label) => el('div', { class: 'section-title' }, el('h2', { class: 'serif', text: title }), link ? el('a', { class: 'by', href: link, text: label }) : null);
      render(...top,
        head('Việc mới chia sẻ', null),
        el('section', { class: 'card' }, works.length ? works.slice(0, 6).map(w => workCard(w, tried, { showAuthor: true })) : el('div', { class: 'empty', text: 'Chưa có việc nào được chia sẻ. Hãy là người đầu tiên.' })),
        docs.length ? head('Tài liệu học mới', '#/tai-lieu', 'Xem tất cả →') : null,
        docs.length ? el('div', { class: 'docs' }, docs.slice(0, 3).map(docCard)) : null,
        head('Thành viên mới', '#/nganh', 'Khám phá cộng đồng →'),
        people.length ? el('div', { class: 'people' }, people.map(personCard)) : el('div', { class: 'card empty', text: 'Chưa có thành viên.' }),
        cta);
    } catch (e) { if (t === renderToken) render(...top, errorCard(e), cta); }
  }

  async function pageCorner(t, ind) {
    if (!CORNER.includes(ind)) ind = CORNER[0];
    const tabs = el('div', { class: 'tabs' }, CORNER.map(k => el('a', { class: 'btn small' + (k === ind ? '' : ' ghost'), href: '#/nganh/' + k }, INDUSTRIES[k])));
    const head = el('section', { class: 'card pad' },
      el('h1', { class: 'serif', style: 'font-size:28px', text: 'Góc ngành: Thiết kế & Quảng cáo' }),
      el('p', { class: 'sub', text: 'Người đi trước chia sẻ cách dùng AI, người đi sau hỏi điều mình đang lo. Đang mở thử một góc ngành.' }),
      el('div', { style: 'margin-top:14px' }, tabs));
    render(head, el('p', { class: 'sub', text: 'Đang tải...' }));
    try {
      const [people, worries] = await Promise.all([api.peopleIn(ind), api.worries(ind)]);
      if (t !== renderToken) return;
      const form = el('form', { class: 'stack' });
      const ta = el('textarea', { id: 'worry', maxlength: String(LIMITS.worry), placeholder: 'Ví dụ: Tôi lo khách hàng sẽ tự dùng AI thay vì thuê mình...' });
      const err = el('p', { class: 'err', hidden: true });
      form.append(el('div', { class: 'field' }, el('label', { for: 'worry', text: 'Tôi đang lo về...' }), ta, el('small', { text: 'Người đi trước cùng ngành sẽ thấy và có thể chia sẻ cách họ vượt qua.' })), err, el('div', null, el('button', { class: 'btn primary small', type: 'submit' }, 'Đăng nỗi lo')));
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (needLogin('Đăng nhập để đăng nỗi lo.')) return;
        const body = ta.value.trim();
        if (body.length < 5) { err.textContent = 'Viết ít nhất 5 ký tự.'; err.hidden = false; return; }
        try { await api.addWorry(state.user.id, ind, body); toast('Đã đăng.'); route(); } catch (x) { console.error(x); err.textContent = 'Chưa đăng được. Thử lại.'; err.hidden = false; }
      });
      const list = el('section', { class: 'card' }, worries.length ? worries.map(r => {
        const mine = state.user && r.user_id === state.user.id;
        return el('div', { class: 'worry' },
          el('a', { class: 'by', href: '#/nguoi/' + r.user_id, text: `${r.profiles?.display_name || 'Thành viên'} · ${fmtDate(r.created_at)}` }),
          el('p', { text: r.body }),
          mine ? el('button', { class: 'link-btn', type: 'button', onclick: async () => { try { await api.deleteWorry(r.id); route(); } catch (x) { console.error(x); toast('Chưa xoá được.'); } } }, 'Xoá')
               : el('button', { class: 'link-btn', type: 'button', onclick: async () => { if (needLogin()) return; try { await api.report(state.user.id, 'worry', r.id); toast('Đã gửi báo cáo.'); } catch (x) { console.error(x); toast('Chưa gửi được.'); } } }, 'Báo cáo'));
      }) : el('div', { class: 'empty', text: 'Chưa có nỗi lo nào. Bạn đang lo điều gì về AI trong nghề của mình?' }));
      render(head,
        el('div', { class: 'section-title' }, el('h2', { class: 'serif', text: `Người làm ${INDUSTRIES[ind].toLowerCase()}` })),
        people.length ? el('div', { class: 'people' }, people.map(personCard)) : el('div', { class: 'card empty', text: 'Chưa có ai trong ngành này. Mời người quen cùng nghề tham gia nhé.' }),
        el('div', { class: 'section-title' }, el('h2', { class: 'serif', text: 'Nỗi lo của người đi sau' })),
        el('section', { class: 'card pad' }, form), list);
    } catch (e) { if (t === renderToken) render(head, errorCard(e)); }
  }

  async function pagePerson(t, id) {
    render(el('p', { class: 'sub', text: 'Đang tải hồ sơ...' }));
    try {
      const p = await api.profile(id);
      if (t !== renderToken) return;
      if (!p) { render(el('section', { class: 'card empty', text: 'Không tìm thấy hồ sơ này.' })); return; }
      const mine = state.user && state.user.id === p.id;
      const [works, followers, connected] = await Promise.all([api.worksOf(p.id), api.followers(p.id), state.user && !mine ? api.isConnected(state.user.id, p.id) : false]);
      const tried = await api.tried(works.map(w => w.id));
      if (t !== renderToken) return;
      const success = tried.filter(x => x.worked).length;
      const btns = el('div', { class: 'row', style: 'margin-top:16px' });
      if (mine) btns.append(el('a', { class: 'btn primary', href: '#/dang' }, 'Đăng việc mới'), el('a', { class: 'btn', href: '#/toi' }, 'Sửa hồ sơ'));
      else btns.append(el('button', { class: 'btn' + (connected ? '' : ' primary'), type: 'button', onclick: async () => {
        if (needLogin('Đăng nhập để kết nối.')) return;
        try { await api.connect(state.user.id, p.id, !connected); toast(connected ? 'Đã huỷ kết nối.' : 'Đã kết nối.'); route(); } catch (e) { console.error(e); toast('Chưa lưu được.'); }
      } }, connected ? 'Đã kết nối' : 'Kết nối'));
      btns.append(el('button', { class: 'btn ghost', type: 'button', onclick: () => copyText(location.origin + location.pathname + '#/nguoi/' + p.id, btns) }, 'Chép link hồ sơ'));

      render(
        el('section', { class: 'card' },
          el('div', { class: 'banner' }),
          el('div', { class: 'head' },
            el('div', { class: 'av big' }, initials(p.display_name)),
            el('h1', { class: 'name serif', text: p.display_name }),
            p.headline ? el('p', { class: 'headline', text: p.headline }) : null,
            el('div', { class: 'tags' },
              el('span', { class: 'tag level', text: levelName(p.ai_level) + ' (tự khai)' }),
              el('span', { class: 'tag', text: 'Ngành: ' + (INDUSTRIES[p.industry] || '') }),
              p.ai_tools ? el('span', { class: 'tag', text: 'AI đang dùng: ' + p.ai_tools }) : null),
            btns),
          el('div', { class: 'stats' },
            el('div', { class: 'stat' }, el('b', { text: String(works.length) }), el('span', { text: 'việc đã làm' })),
            el('div', { class: 'stat' }, el('b', { text: String(success) }), el('span', { text: 'lượt làm theo thành công' })),
            el('div', { class: 'stat' }, el('b', { text: String(followers) }), el('span', { text: 'người kết nối' })))),
        p.style ? el('section', { class: 'card pad' }, el('div', { class: 'label', text: 'Phong cách làm việc với AI' }), el('div', { class: 'style-box', text: p.style })) : null,
        el('section', { class: 'card pad' },
          el('div', { class: 'label', text: 'Cấp độ dùng AI' }),
          el('p', { class: 'sub', text: 'Một con đường đi lên, không phải bảng xếp hạng. Cấp cao hơn không tự động tốt hơn.' }),
          levelLadder(p.ai_level)),
        el('div', { class: 'section-title' }, el('h2', { class: 'serif', text: 'Việc đã làm' })),
        el('section', { class: 'card' }, works.length ? works.map(w => workCard(w, tried)) : el('div', { class: 'empty', text: mine ? 'Bạn chưa đăng việc nào. Bấm "Đăng việc mới" để bắt đầu.' : 'Người này chưa đăng việc nào.' })),
        mine ? null : el('div', null, el('button', { class: 'link-btn', type: 'button', onclick: async () => { if (needLogin()) return; try { await api.report(state.user.id, 'profile', p.id); toast('Đã gửi báo cáo.'); } catch (e) { console.error(e); toast('Chưa gửi được.'); } } }, 'Báo cáo hồ sơ này'))
      );
    } catch (e) { if (t === renderToken) render(errorCard(e)); }
  }

  function field(id, label, input, hint) {
    input.id = id;
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), input, hint ? el('small', { text: hint }) : null);
  }

  function pageMe() {
    if (!state.user) {
      render(el('section', { class: 'card pad' }, el('h1', { class: 'serif', style: 'font-size:26px', text: 'Tạo hồ sơ của bạn' }), el('p', { class: 'sub', text: 'Đăng nhập bằng Google để bắt đầu. Chỉ mất 1 phút.' }), el('div', { style: 'margin-top:14px' }, el('button', { class: 'btn primary', type: 'button', onclick: signIn }, 'Đăng nhập bằng Google'))));
      return;
    }
    const m = state.me || {};
    const name = el('input', { maxlength: String(LIMITS.display_name), required: true, value: m.display_name || '' });
    const headline = el('input', { maxlength: String(LIMITS.headline), value: m.headline || '', placeholder: 'Ví dụ: Designer tự do, 5 năm làm ảnh quảng cáo' });
    const ind = el('select', null, Object.entries(INDUSTRIES).map(([k, v]) => el('option', { value: k, selected: (m.industry || 'thiet-ke') === k }, v)));
    const lvl = el('select', null, LEVELS.map(([i, n, d]) => el('option', { value: String(i), selected: (m.ai_level || 1) === i }, `Cấp ${i} · ${n}: ${d}`)));
    const tools = el('input', { maxlength: String(LIMITS.ai_tools), value: m.ai_tools || '', placeholder: 'Ví dụ: ChatGPT, Midjourney' });
    const style = el('textarea', { maxlength: String(LIMITS.style), placeholder: 'Ví dụ: Luôn bắt AI đưa 3 phương án rồi tự chọn. Không dùng AI cho phần ý tưởng gốc.' });
    style.value = m.style || '';
    const err = el('p', { class: 'err', hidden: true });
    const form = el('form', { class: 'stack' },
      field('f-name', 'Tên hiển thị *', name, 'Tên mọi người sẽ thấy. Có thể là biệt danh.'),
      field('f-head', 'Một dòng giới thiệu', headline),
      el('div', { class: 'grid2' }, field('f-ind', 'Ngành nghề *', ind), field('f-lvl', 'Cấp độ dùng AI *', lvl, 'Tự đánh giá. Cấp được tin hơn khi bạn đăng việc kèm bằng chứng.')),
      field('f-tools', 'AI bạn đang dùng', tools),
      field('f-style', 'Phong cách làm việc với AI', style, 'Cách bạn giao việc, kiểm tra kết quả, điều bạn không giao cho AI.'),
      err,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'submit' }, state.me ? 'Lưu hồ sơ' : 'Tạo hồ sơ'), el('button', { class: 'btn ghost', type: 'button', onclick: doSignOut }, 'Đăng xuất'))
    );
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const dn = name.value.trim();
      if (!dn) { err.textContent = 'Hãy nhập tên hiển thị.'; err.hidden = false; return; }
      try {
        await api.saveProfile(state.user.id, { display_name: dn, headline: headline.value.trim() || null, industry: ind.value, ai_level: Number(lvl.value), ai_tools: tools.value.trim() || null, style: style.value.trim() || null });
        await loadMe(); renderWho(); toast('Đã lưu hồ sơ.');
        location.hash = '#/nguoi/' + state.user.id;
      } catch (x) { console.error(x); err.textContent = 'Chưa lưu được. Kiểm tra lại các ô rồi thử lại.'; err.hidden = false; }
    });
    const parts = [el('section', { class: 'card pad' },
      el('h1', { class: 'serif', style: 'font-size:26px', text: state.me ? 'Sửa hồ sơ' : 'Tạo hồ sơ của bạn' }),
      el('p', { class: 'sub', text: 'Hồ sơ công khai: ai cũng xem được. Không ghi số điện thoại, địa chỉ hay thông tin riêng tư.' }),
      el('div', { style: 'margin-top:16px' }, form))];
    if (state.me) {
      let armed = false;
      const del = el('button', { class: 'btn ghost small', type: 'button', onclick: async () => {
        if (!armed) { armed = true; del.textContent = 'Bấm lần nữa: xoá vĩnh viễn hồ sơ và mọi việc đã đăng'; return; }
        try { await api.deleteProfile(state.user.id); await api.signOut(); toast('Đã xoá hồ sơ.'); location.hash = '#/'; } catch (x) { console.error(x); toast('Chưa xoá được.'); }
      } }, 'Xoá hồ sơ');
      parts.push(el('section', { class: 'card pad' }, el('div', { class: 'label', text: 'Xoá hồ sơ' }), el('p', { class: 'sub', text: 'Xoá hồ sơ sẽ xoá luôn mọi việc, nỗi lo và kết nối của bạn.' }), el('div', { style: 'margin-top:10px' }, del)));
    }
    render(...parts);
  }

  function pageNewWork() {
    if (!state.user || !state.me) { pageMe(); return; }
    const mk = (tag, key, ph) => { const n = el(tag, { maxlength: String(LIMITS[key]), placeholder: ph || '' }); return n; };
    const f = {
      title: mk('input', 'title', 'Ví dụ: Làm 20 phương án ảnh quảng cáo trong 1 buổi'),
      problem: mk('textarea', 'problem', 'Trước đây bạn gặp khó khăn gì?'),
      ai_used: mk('input', 'ai_used', 'Ví dụ: ChatGPT + Canva'),
      evidence_url: mk('input', 'evidence_url', 'https://... (bài đăng, ảnh, file kết quả)'),
      result: mk('textarea', 'result', 'AI đã làm gì, bạn làm gì, kết quả ra sao?'),
      saved: mk('input', 'saved', 'Ví dụ: từ 2 ngày còn nửa ngày'),
      lesson: mk('textarea', 'lesson', 'Người khác muốn làm lại thì cần làm những bước nào? Điều gì cần cẩn thận?')
    };
    const err = el('p', { class: 'err', hidden: true });
    const form = el('form', { class: 'stack' },
      field('w-title', 'Tên việc *', f.title),
      field('w-problem', 'Vấn đề *', f.problem),
      field('w-ai', 'AI đã dùng *', f.ai_used),
      field('w-result', 'Kết quả *', f.result),
      field('w-saved', 'Tiết kiệm được', f.saved, 'Ghi số thật. Chưa đo thì để trống.'),
      field('w-lesson', 'Bài học, cách làm lại *', f.lesson),
      field('w-proof', 'Link bằng chứng', f.evidence_url, 'Có link (bắt đầu bằng https://) thì bài được gắn nhãn "Có bằng chứng". Xoá thông tin riêng tư trước khi chia sẻ.'),
      err,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'submit' }, 'Đăng việc'), el('a', { class: 'btn ghost', href: '#/nguoi/' + state.user.id }, 'Huỷ'))
    );
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value.trim()]));
      const need = [['title', 3, 'Tên việc'], ['problem', 3, 'Vấn đề'], ['ai_used', 1, 'AI đã dùng'], ['result', 3, 'Kết quả'], ['lesson', 3, 'Bài học']];
      const miss = need.find(([k, min]) => v[k].length < min);
      if (miss) { err.textContent = `Hãy điền ô "${miss[2]}".`; err.hidden = false; return; }
      if (v.evidence_url && !isHttps(v.evidence_url)) { err.textContent = 'Link bằng chứng phải bắt đầu bằng https:// và không có dấu cách.'; err.hidden = false; return; }
      try {
        await api.addWork(state.user.id, { ...v, evidence_url: v.evidence_url || null, saved: v.saved || null });
        toast('Đã đăng.'); location.hash = '#/nguoi/' + state.user.id;
      } catch (x) { console.error(x); err.textContent = 'Chưa đăng được. Kiểm tra lại các ô rồi thử lại.'; err.hidden = false; }
    });
    render(el('section', { class: 'card pad' },
      el('h1', { class: 'serif', style: 'font-size:26px', text: 'Đăng việc bạn đã làm cùng AI' }),
      el('p', { class: 'sub', text: 'Viết thật, viết cụ thể. Người cùng nghề sẽ dựa vào đây để làm theo.' }),
      el('div', { style: 'margin-top:16px' }, form)));
  }

  // ---------- Tài liệu học ----------
  // Mỗi tài liệu là một link: bấm vào là mở thẳng trang tài liệu gốc ở thẻ mới.
  function docCard(d) {
    const ext = d.link && isHttps(d.link);
    const box = el('article', { class: 'card doc-card' });
    let host = '';
    try { host = ext ? new URL(d.link).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
    box.append(
      el('span', { class: 'tag', text: d.topic }),
      el('h3', { class: 'serif' }, ext ? el('a', { href: d.link, target: '_blank', rel: 'noopener noreferrer', text: d.title + ' ↗' }) : el('a', { href: '#/tai-lieu/' + d.id, text: d.title })),
      d.summary ? el('p', { class: 'sub', text: d.summary }) : null,
      el('div', { class: 'doc-foot' },
        el('span', { class: 'by', text: (host ? host + ' · ' : '') + fmtDate(d.created_at) }),
        el('button', { class: 'link-btn', type: 'button', onclick: () => copyText(docPrompt(d), box) }, 'Học cùng AI của bạn'),
        state.isAdmin ? el('a', { class: 'link-btn', href: '#/tai-lieu/sua/' + d.id }, 'Sửa') : null));
    return box;
  }

  async function pageDocs(t, topic) {
    const head = el('section', { class: 'card pad' },
      el('div', { class: 'row', style: 'justify-content:space-between' },
        el('div', null,
          el('h1', { class: 'serif', style: 'font-size:28px', text: 'Tài liệu học' }),
          el('p', { class: 'sub', text: 'Tài liệu Sir soạn và chọn lọc để mọi người học dùng AI. Đọc miễn phí, không cần đăng nhập.' })),
        state.isAdmin ? el('a', { class: 'btn primary', href: '#/tai-lieu/moi' }, 'Đăng tài liệu') : null));
    render(head, el('p', { class: 'sub', text: 'Đang tải...' }));
    try {
      const docs = await api.docs();
      if (t !== renderToken) return;
      const topics = [...new Set(docs.map(d => d.topic))];
      const shown = topic ? docs.filter(d => d.topic === topic) : docs;
      const filters = topics.length > 1 ? el('div', { class: 'tabs' },
        el('a', { class: 'btn small' + (topic ? ' ghost' : ''), href: '#/tai-lieu' }, 'Tất cả'),
        topics.map(k => el('a', { class: 'btn small' + (k === topic ? '' : ' ghost'), href: '#/tai-lieu?chu-de=' + encodeURIComponent(k) }, k))) : null;
      render(head, filters,
        shown.length ? el('div', { class: 'docs' }, shown.map(docCard))
                     : el('div', { class: 'card empty', text: state.isAdmin ? 'Chưa có tài liệu. Bấm "Đăng tài liệu" để đăng bài đầu tiên.' : 'Chưa có tài liệu. Quay lại sau nhé.' }));
    } catch (e) { if (t === renderToken) render(head, errorCard(e)); }
  }

  function docPrompt(d) {
    const body = (d.body || '').slice(0, 8000);
    return [
      'Mình đang học tài liệu dưới đây về AI. Bạn hãy:',
      '1. Tóm tắt ý chính bằng lời đơn giản, mỗi ý kèm một ví dụ đời thường.',
      '2. Hỏi mình đang làm nghề gì để chỉ cách áp dụng vào công việc của mình.',
      '3. Cuối cùng đặt 3 câu hỏi ngắn để mình tự kiểm tra đã hiểu chưa.',
      'Chỉ dựa trên nội dung tài liệu. Chỗ nào tài liệu không nói thì nói rõ là không có.',
      '',
      `Tài liệu: ${d.title}`,
      `Chủ đề: ${d.topic}`,
      d.summary ? `Tóm tắt: ${d.summary}` : '',
      d.link ? `Link: ${d.link}` : '',
      body ? `Nội dung:\n${body}` : '',
      `Nguồn: ${location.origin}${location.pathname}#/tai-lieu/${d.id}`
    ].filter(Boolean).join('\n');
  }

  async function pageDoc(t, id) {
    render(el('p', { class: 'sub', text: 'Đang tải tài liệu...' }));
    try {
      const d = await api.doc(id);
      if (t !== renderToken) return;
      if (!d) { render(el('section', { class: 'card empty', text: 'Không tìm thấy tài liệu này.' })); return; }
      const box = el('section', { class: 'card pad' });
      const actions = el('div', { class: 'row', style: 'margin-top:16px' },
        d.link && isHttps(d.link) ? el('a', { class: 'btn primary', href: d.link, target: '_blank', rel: 'noopener noreferrer' }, 'Mở tài liệu gốc') : null,
        el('button', { class: 'btn', type: 'button', onclick: () => copyText(docPrompt(d), box) }, 'Học cùng AI của bạn'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => copyText(location.origin + location.pathname + '#/tai-lieu/' + d.id, box) }, 'Chép link'));
      if (state.isAdmin) {
        let armed = false;
        const del = el('button', { class: 'link-btn', type: 'button', onclick: async () => {
          if (!armed) { armed = true; del.textContent = 'Bấm lần nữa để xoá vĩnh viễn'; return; }
          try { await api.deleteDoc(d.id); toast('Đã xoá tài liệu.'); location.hash = '#/tai-lieu'; } catch (e) { console.error(e); toast('Chưa xoá được.'); }
        } }, 'Xoá');
        actions.append(el('a', { class: 'btn ghost', href: '#/tai-lieu/sua/' + d.id }, 'Sửa'), del);
      }
      box.append(
        el('a', { class: 'by', href: '#/tai-lieu', text: '← Tất cả tài liệu' }),
        el('div', { class: 'tags' }, el('span', { class: 'tag level', text: d.topic }), el('span', { class: 'tag', text: fmtDate(d.created_at) })),
        el('h1', { class: 'name serif', text: d.title }),
        d.summary ? el('p', { class: 'headline', text: d.summary }) : null,
        actions,
        d.body ? el('div', { class: 'doc-body', text: d.body }) : null);
      render(box, el('p', { class: 'sub', text: 'Nút "Học cùng AI của bạn" chép sẵn tài liệu kèm lời dặn. Dán vào ChatGPT, Gemini hoặc Claude để được giải thích và kiểm tra lại.' }));
    } catch (e) { if (t === renderToken) render(errorCard(e)); }
  }

  async function pageDocForm(t, id) {
    if (!state.isAdmin) { render(el('section', { class: 'card empty', text: 'Chỉ quản trị viên được đăng tài liệu.' })); return; }
    let d = {};
    if (id) { try { d = (await api.doc(id)) || {}; } catch (e) { render(errorCard(e)); return; } if (t !== renderToken) return; }
    const f = {
      title: el('input', { maxlength: '160', value: d.title || '', placeholder: 'Ví dụ: Bắt đầu với Claude trong 15 phút' }),
      topic: el('input', { maxlength: '60', value: d.topic || '', placeholder: 'Ví dụ: Nhập môn, Claude Code, Thiết kế' }),
      summary: el('textarea', { maxlength: '400', placeholder: '1-2 câu: tài liệu này giúp người đọc làm được gì?' }),
      link: el('input', { maxlength: '500', value: d.link || '', placeholder: 'https://... (Google Doc, PDF, video). Có thể để trống' }),
      body: el('textarea', { maxlength: '20000', rows: '14', placeholder: 'Viết nội dung trực tiếp ở đây. Có thể để trống nếu đã có link.' })
    };
    f.summary.value = d.summary || ''; f.body.value = d.body || '';
    const err = el('p', { class: 'err', hidden: true });
    const form = el('form', { class: 'stack' },
      field('d-title', 'Tên tài liệu *', f.title),
      field('d-topic', 'Chủ đề *', f.topic, 'Tài liệu cùng chủ đề sẽ được gom lại để người đọc lọc.'),
      field('d-link', 'Link tài liệu *', f.link, 'Người đọc bấm vào tên tài liệu sẽ mở thẳng link này. Nếu là Google Doc: bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được" trước.'),
      field('d-summary', 'Tóm tắt', f.summary, 'Hiện dưới tên tài liệu, giúp người đọc biết có nên mở không.'),
      err,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'submit' }, id ? 'Lưu thay đổi' : 'Đăng tài liệu'), el('a', { class: 'btn ghost', href: id ? '#/tai-lieu/' + id : '#/tai-lieu' }, 'Huỷ')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = { title: f.title.value.trim(), topic: f.topic.value.trim(), summary: f.summary.value.trim() || null, link: f.link.value.trim() || null };
      const bad = m => { err.textContent = m; err.hidden = false; };
      if (v.title.length < 3) return bad('Tên tài liệu cần ít nhất 3 ký tự.');
      if (!v.topic) return bad('Hãy nhập chủ đề.');
      if (!v.link) return bad('Hãy dán link tài liệu.');
      if (!isHttps(v.link)) return bad('Link phải bắt đầu bằng https:// và không có dấu cách.');
      try { await api.saveDoc(state.user.id, v, id); toast(id ? 'Đã lưu.' : 'Đã đăng tài liệu.'); location.hash = id ? '#/tai-lieu/' + id : '#/tai-lieu'; }
      catch (x) { console.error(x); bad('Chưa lưu được. Kiểm tra lại các ô rồi thử lại.'); }
    });
    render(el('section', { class: 'card pad' },
      el('h1', { class: 'serif', style: 'font-size:26px', text: id ? 'Sửa tài liệu' : 'Đăng tài liệu học' }),
      el('p', { class: 'sub', text: 'Tài liệu công khai: ai cũng đọc được, không cần đăng nhập.' }),
      el('div', { style: 'margin-top:16px' }, form)));
  }

  // ---------- Điều hướng ----------
  function route() {
    const t = ++renderToken;
    const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
    const parts = path.split('/');
    const r = parts[0] || 'home';
    const q = new URLSearchParams(query || '');
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('on', a.dataset.route === r));
    if (state.user && !state.me && r !== 'toi' && r !== 'tai-lieu') { location.hash = '#/toi'; return; }
    window.scrollTo(0, 0);
    if (r === 'tai-lieu') {
      if (parts[1] === 'moi') return pageDocForm(t);
      if (parts[1] === 'sua' && parts[2]) return pageDocForm(t, decodeURIComponent(parts[2]));
      if (parts[1]) return pageDoc(t, decodeURIComponent(parts[1]));
      return pageDocs(t, q.get('chu-de'));
    }
    if (r === 'nganh') return pageCorner(t, parts[1]);
    if (r === 'nguoi' && parts[1]) return pagePerson(t, decodeURIComponent(parts[1]));
    if (r === 'toi') return pageMe();
    if (r === 'dang') return pageNewWork();
    return pageHome(t);
  }

  async function start() {
    document.getElementById('appName').textContent = APP;
    document.getElementById('footName').textContent = APP;
    document.title = APP;
    document.getElementById('demoBar').hidden = LIVE;
    state.user = await api.session().catch(() => null);
    await loadMe();
    if (LIVE && /[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    renderWho();
    api.onAuth(async u => {
      const changed = (u?.id || null) !== (state.user?.id || null);
      state.user = u; await loadMe(); renderWho();
      if (changed) route();
    });
    window.addEventListener('hashchange', route);
    route();
  }
  start();
})();
