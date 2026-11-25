/* Web công ty Gradisy: phần dùng chung cho 3 trang.
   - Menu điện thoại, chuyển link cũ (#doi-ngu…) sang trang mới
   - Nút liên hệ Zalo/Email
   - Trợ lý tư vấn theo kịch bản (không dùng AI, 0đ). Lưu khách vào Supabase nếu đã chạy khach-tu-van.sql.

   >>> SIR ĐIỀN Ở ĐÂY (để trống thì nút Zalo/Email tự ẩn) <<<
   zalo: số điện thoại dùng Zalo, chỉ chữ số, ví dụ "0912345678"
   email: địa chỉ email công việc                                            */
var LIEN_HE = { zalo: "", email: "" };

/* Kịch bản trợ lý. Sửa câu chữ hoặc thêm lựa chọn ngay trong bảng này.
   goi: "tdh" = Luồng việc tự chạy, "pm" = Ứng dụng may đo, "tv" = cần trao đổi trực tiếp */
var KICH_BAN = {
  chao: "Chào bạn. Mình là trợ lý của Gradisy. Trả lời 4 câu ngắn, mình gợi ý việc nào của bạn nên giao cho AI. Miễn phí.",
  nganh: {
    hoi: "Bạn đang làm lĩnh vực nào?",
    chon: [
      { id: "online", chu: "Bán hàng online" },
      { id: "dichvu", chu: "Phòng khám, spa, dịch vụ đặt lịch" },
      { id: "vanphong", chu: "Văn phòng, công ty" },
      { id: "khac", chu: "Lĩnh vực khác" }
    ]
  },
  viec: {
    hoi: "Việc nào đang lặp lại và tốn giờ nhất?",
    theoNganh: {
      online:   [ { chu: "Gom đơn từ nhiều sàn về một bảng", goi: "tdh", vd: 0 },
                  { chu: "Làm báo cáo doanh thu, tồn kho", goi: "tdh", vd: 0 },
                  { chu: "Trả lời mãi những câu khách hỏi giống nhau", goi: "pm", vd: 2 } ],
      dichvu:   [ { chu: "Đặt lịch và nhắc lịch khách", goi: "pm", vd: 1 },
                  { chu: "Quản lý hồ sơ khách", goi: "pm", vd: 1 },
                  { chu: "Trả lời câu hỏi thường gặp", goi: "pm", vd: 2 } ],
      vanphong: [ { chu: "Làm báo cáo từ file Excel", goi: "tdh", vd: 0 },
                  { chu: "Gom dữ liệu từ nhiều file", goi: "tdh", vd: 0 },
                  { chu: "Hỏi đáp quy trình, mẫu biểu nội bộ", goi: "pm", vd: 2 } ],
      khac:     [ { chu: "Nhập liệu, làm báo cáo", goi: "tdh", vd: 0 },
                  { chu: "Chăm sóc, nhắc lịch khách", goi: "pm", vd: 1 },
                  { chu: "Trả lời câu hỏi lặp lại", goi: "pm", vd: 2 } ]
    },
    khac: "Việc khác (tự ghi)"
  },
  gio: { hoi: "Mỗi tuần việc đó mất khoảng bao lâu?", chon: ["Dưới 2 giờ", "2 đến 5 giờ", "Trên 5 giờ"] },
  dung: { hoi: "Hiện bạn đang làm việc đó bằng gì?", chon: ["Excel, Google Sheet", "Zalo, Messenger", "Một phần mềm có sẵn", "Giấy, sổ tay"] },
  goi: {
    tdh: { ten: "Luồng việc tự chạy (tự động hoá)", vi: "Việc của bạn là làm tay lặp đi lặp lại trên file và bảng. Máy có thể tự chạy phần này, bạn vẫn dùng công cụ quen thuộc." },
    pm:  { ten: "Ứng dụng may đo (phần mềm riêng)", vi: "Việc của bạn cần một chỗ riêng để nhiều người cùng dùng hoặc để khách tự thao tác. Một trang web hoặc ứng dụng nhỏ sẽ hợp." },
    tv:  { ten: "Trao đổi trực tiếp", vi: "Việc của bạn cần nghe kỹ hơn trước khi gợi ý. Chúng tôi sẽ hỏi thêm vài câu rồi đề xuất cách làm." }
  },
  viDu: [
    "Ví dụ tương tự: shop online bán 3 nơi, thay việc chép đơn mỗi tối bằng một bảng tự cập nhật.",
    "Ví dụ tương tự: phòng khám nha, làm phần đặt lịch và nhắc lịch trước.",
    "Ví dụ tương tự: công ty 30 người, trợ lý AI trả lời câu hỏi về quy trình và mẫu biểu."
  ],
  gioNho: "Việc này hiện còn nhỏ. Khi trao đổi, chúng tôi sẽ nói thẳng nếu chưa đáng làm.",
  chot: "Đây là gợi ý ban đầu. Chúng tôi xem việc thật rồi mới báo giá trọn gói.",
  xong: "Đã nhận. Chúng tôi liên hệ lại trong 24 giờ.",
  loi: "Chưa gửi được. Bạn nhắn thẳng cho chúng tôi nhé:",
  quaLuot: "Bạn đã gửi rồi. Chúng tôi sẽ liên hệ sớm."
};

(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, text) {
    var x = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) x.setAttribute(k, attrs[k]); });
    if (text != null) x.textContent = text;
    return x;
  }
  function luu(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* link cũ: cong-ty/#doi-ngu ... chuyển sang trang mới */
  var CU = { "gioi-thieu": "ve-chung-toi/#gioi-thieu", "tam-nhin": "ve-chung-toi/#tam-nhin", "su-menh": "ve-chung-toi/#gia-tri",
             "doi-ngu": "ve-chung-toi/#doi-ngu", "san-pham": "dich-vu/", "mot-mot": "dich-vu/#tu-van", "goc-nhin": "dich-vu/#cau-hoi",
             "tham-gia": "#lien-he" };
  if (document.body.dataset.trang === "chu") {
    var h = location.hash.slice(1);
    if (CU[h] && CU[h].charAt(0) !== "#") location.replace(CU[h]);
  }

  /* menu điện thoại */
  var mnav = $(".mnav"), menu = $(".menu");
  if (mnav && menu) {
    mnav.addEventListener("click", function () {
      var mo = menu.classList.toggle("open");
      mnav.setAttribute("aria-expanded", mo); mnav.textContent = mo ? "×" : "☰";
    });
  }

  /* nút liên hệ */
  function linkZalo(tin) { return LIEN_HE.zalo ? "https://zalo.me/" + LIEN_HE.zalo.replace(/\D/g, "") : null; }
  function linkEmail(tin) {
    return LIEN_HE.email ? "mailto:" + LIEN_HE.email + "?subject=" + encodeURIComponent("Tư vấn Gradisy") + (tin ? "&body=" + encodeURIComponent(tin) : "") : null;
  }
  $$("[data-lien-he]").forEach(function (a) {
    var href = a.dataset.lienHe === "zalo" ? linkZalo() : linkEmail();
    if (href) { a.href = href; if (a.dataset.lienHe === "zalo") { a.target = "_blank"; a.rel = "noopener"; } } else a.hidden = true;
  });
  var chuaCo = $("[data-chua-co-lien-he]");
  if (chuaCo) chuaCo.hidden = !!(LIEN_HE.zalo || LIEN_HE.email);

  /* ---------- trợ lý tư vấn ---------- */
  var cfg = window.APP_CONFIG || {};
  var nutMo = el("button", { type: "button", class: "btn main tv-open", "aria-haspopup": "dialog" }, "Tư vấn miễn phí");
  var hop = el("div", { class: "tv", role: "dialog", "aria-modal": "true", "aria-labelledby": "tv-ten", hidden: "" });
  hop.innerHTML = '<header><div><b id="tv-ten">Trợ lý Gradisy</b><small>Tư vấn miễn phí · khoảng 1 phút</small></div>' +
    '<button type="button" class="x" aria-label="Đóng trợ lý">×</button></header>' +
    '<div class="log" aria-live="polite"></div>';
  document.body.appendChild(nutMo); document.body.appendChild(hop);
  var log = $(".log", hop), nutTruoc = null, tl = {}, daBatDau = false;

  log.tabIndex = -1;  // để giữ viền chọn trong khung khi nút vừa bấm biến mất
  function noi(chu, cls) { var m = el("div", { class: "m " + (cls || "bot") }, chu); log.appendChild(m); log.scrollTop = log.scrollHeight; if (!hop.contains(document.activeElement)) log.focus({ preventScroll: true }); return m; }
  function hoi(buoc, chu, luaChon, khiChon) {
    var m = noi(chu); m.insertBefore(el("span", { class: "step" }, "Câu " + buoc + "/4 · "), m.firstChild);
    var o = el("div", { class: "opts" });
    luaChon.forEach(function (c) {
      var b = el("button", { type: "button" }, c.chu || c);
      b.addEventListener("click", function () { o.remove(); noi(c.chu || c, "me"); khiChon(c); });
      o.appendChild(b);
    });
    log.appendChild(o); log.scrollTop = log.scrollHeight;
    var dau = o.querySelector("button"); if (dau) dau.focus();
  }
  function batDau() {
    log.innerHTML = ""; tl = {};
    noi(KICH_BAN.chao);
    hoi(1, KICH_BAN.nganh.hoi, KICH_BAN.nganh.chon, function (c) {
      tl.nganh = c.chu;
      var ds = KICH_BAN.viec.theoNganh[c.id].concat([{ chu: KICH_BAN.viec.khac, goi: "tv", khac: true }]);
      hoi(2, KICH_BAN.viec.hoi, ds, function (v) {
        tl.goi = v.goi; tl.vd = v.vd;
        if (v.khac) {
          var f = el("form"); var lb = el("label", { for: "tv-viec" }, "Việc đó là gì?");
          var ip = el("input", { id: "tv-viec", maxlength: "200", autocomplete: "off" });
          var ok = el("button", { type: "submit", class: "btn" }, "Tiếp");
          f.append(lb, ip, ok); log.appendChild(f); ip.focus();
          f.addEventListener("submit", function (e) { e.preventDefault(); var t = ip.value.trim(); if (!t) { ip.focus(); return; } f.remove(); noi(t, "me"); tl.viec = t; cau3(); });
        } else { tl.viec = v.chu; cau3(); }
      });
    });
  }
  function cau3() {
    hoi(3, KICH_BAN.gio.hoi, KICH_BAN.gio.chon, function (g) {
      tl.gio = g;
      hoi(4, KICH_BAN.dung.hoi, KICH_BAN.dung.chon, function (d) { tl.dung = d; ketQua(); });
    });
  }
  function tomTat() { return "Lĩnh vực: " + tl.nganh + "\nViệc: " + tl.viec + "\nThời gian: " + tl.gio + "/tuần\nĐang dùng: " + tl.dung; }
  function ketQua() {
    var g = KICH_BAN.goi[tl.goi] || KICH_BAN.goi.tv;
    var kq = el("div", { class: "m kq" }); kq.appendChild(el("b", null, "Gợi ý: " + g.ten));
    kq.appendChild(el("p", null, g.vi));
    if (tl.vd != null && tl.goi !== "tv") kq.appendChild(el("p", null, KICH_BAN.viDu[tl.vd]));
    if (tl.gio === KICH_BAN.gio.chon[0]) kq.appendChild(el("p", null, KICH_BAN.gioNho));
    kq.appendChild(el("p", { class: "step" }, KICH_BAN.chot));
    log.appendChild(kq); tl.goiTen = g.ten;
    form();
  }
  function form() {
    var f = el("form", { novalidate: "" });
    f.innerHTML = '<label for="tv-ten-kh">Tên của bạn</label><input id="tv-ten-kh" name="ten" maxlength="80" autocomplete="name" required>' +
      '<label for="tv-lh">Số Zalo hoặc email để chúng tôi liên hệ</label><input id="tv-lh" name="lien_he" maxlength="120" autocomplete="tel" inputmode="email" required>' +
      '<label for="tv-ghi">Ghi thêm (không bắt buộc)</label><textarea id="tv-ghi" name="ghi_chu" maxlength="500"></textarea>' +
      '<div class="bay" aria-hidden="true"><label for="tv-web">Website</label><input id="tv-web" name="web" tabindex="-1" autocomplete="off"></div>' +
      '<p class="err" hidden></p><button type="submit" class="btn main">Gửi cho Gradisy</button>';
    log.appendChild(f); log.scrollTop = log.scrollHeight;
    var err = $(".err", f), nut = $("button[type=submit]", f);
    f.addEventListener("input", function () { err.hidden = true; });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ten = f.ten.value.trim(), lh = f.lien_he.value.trim();
      if (!ten) { err.textContent = "Bạn điền tên giúp mình nhé."; err.hidden = false; f.ten.focus(); return; }
      if (!/^\+?[\d\s.]{9,15}$/.test(lh) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lh)) { err.textContent = "Số Zalo (9–11 chữ số) hoặc email chưa đúng."; err.hidden = false; f.lien_he.focus(); return; }
      if (f.web.value) return;  // máy tự điền ô bẫy: bỏ qua
      var lan = JSON.parse(luu("gr_tv_lan") || "[]").filter(function (t) { return Date.now() - t < 3600e3; });
      if (lan.length >= 3) { f.remove(); noi(KICH_BAN.quaLuot); return; }
      nut.disabled = true; nut.textContent = "Đang gửi…";
      var duLieu = { ten: ten, lien_he: lh, ghi_chu: f.ghi_chu.value.trim() || null, nganh: tl.nganh, viec: tl.viec, gio: tl.gio, dang_dung: tl.dung, goi_y: tl.goiTen, trang: location.pathname };
      gui(duLieu).then(function () {
        lan.push(Date.now()); luu("gr_tv_lan", JSON.stringify(lan));
        f.remove(); noi(KICH_BAN.xong); nutLienHe(true);
      }).catch(function () {
        f.remove(); noi(KICH_BAN.loi); nutLienHe(false);
      });
    });
  }
  function gui(d) {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return Promise.reject(new Error("chua cau hinh"));
    return fetch(cfg.SUPABASE_URL + "/rest/v1/khach_tu_van", {
      method: "POST",
      headers: { "apikey": cfg.SUPABASE_ANON_KEY, "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify(d)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
  }
  function nutLienHe(daGui) {
    var tin = (daGui ? "Mình vừa gửi yêu cầu tư vấn trên web.\n" : "Mình muốn tư vấn.\n") + tomTat();
    var o = el("div", { class: "opts" });
    var z = linkZalo(), m = linkEmail(tin);
    if (z) { var a = el("a", { class: "btn", href: z, target: "_blank", rel: "noopener" }, "Nhắn Zalo"); o.appendChild(a); }
    if (m) { var b = el("a", { class: "btn", href: m }, "Gửi email"); o.appendChild(b); }
    if (!z && !m) {  // chưa điền Zalo/Email: tạm dẫn về kênh YouTube để khách không bị kẹt
      o.appendChild(el("p", { class: "step" }, "Zalo và email đang cập nhật. Tạm thời bạn để lại bình luận trên kênh YouTube của chúng tôi:"));
      o.appendChild(el("a", { class: "btn", href: "https://www.youtube.com/@Vannam_alexhayes", target: "_blank", rel: "noopener" }, "Mở kênh YouTube"));
    }
    log.appendChild(o); log.scrollTop = log.scrollHeight;
  }

  function mo(e) {
    nutTruoc = (e && e.currentTarget) || document.activeElement;
    hop.hidden = false; nutMo.hidden = true;
    if (!daBatDau) { batDau(); daBatDau = true; } else { var f = hop.querySelector("button, input, a"); if (f) f.focus(); }
  }
  function dong() { hop.hidden = true; nutMo.hidden = false; if (nutTruoc && nutTruoc.focus) nutTruoc.focus(); }
  nutMo.addEventListener("click", mo);
  var nutTrang = $$("[data-tu-van]");
  nutTrang.forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); mo(e); }); });
  /* một nút chính mỗi màn hình: nút nổi chỉ hiện khi nút "Tư vấn miễn phí" của trang đã khuất */
  if ("IntersectionObserver" in window && nutTrang.length) {
    var dangThay = new Set();
    nutMo.hidden = true;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) dangThay.add(x.target); else dangThay.delete(x.target); });
      if (hop.hidden) nutMo.hidden = dangThay.size > 0;
    });
    nutTrang.forEach(function (b) { io.observe(b); });
    var dongCu = dong; dong = function () { dongCu(); nutMo.hidden = dangThay.size > 0; };
  }
  $(".x", hop).addEventListener("click", function () { dong(); });
  document.addEventListener("keydown", function (e) {
    if (hop.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); dong(); return; }
    if (e.key !== "Tab") return;  // giữ phím Tab trong khung
    var f = $$("button, input, textarea, a[href]", hop).filter(function (x) { return !x.disabled && x.offsetParent !== null && x.tabIndex !== -1; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  if (location.hash === "#tu-van-mien-phi") mo();
})();
