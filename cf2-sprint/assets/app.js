/* 公司财务Ⅱ 期末冲刺 · 交互脚本 v2
   功能：① quiz 即时判分 ② 模拟卷计分条 ③ 公式默写模式 ④ 阅读进度条 ⑤ 打印时展开分步 */
document.addEventListener('DOMContentLoaded', function () {

  /* ⓪ KaTeX 公式渲染（页面引入 katex + auto-render 时生效） */
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  /* ① quiz：点选项即时判分 + 解析（retrieval practice） */
  var total = 0, done = 0, ok = 0;
  var quizzes = document.querySelectorAll('.quiz');
  total = quizzes.length;
  quizzes.forEach(function (qz) {
    var answer = qz.getAttribute('data-answer');
    var explain = qz.getAttribute('data-explain') || '';
    var opts = qz.querySelectorAll('.q-opt');
    var fb = qz.querySelector('.q-feedback');
    var answered = false;
    opts.forEach(function (opt) {
      opt.addEventListener('click', function () {
        if (answered) return;
        answered = true; done++;
        var key = opt.getAttribute('data-key');
        opts.forEach(function (o) { o.style.pointerEvents = 'none'; });
        if (key === answer) {
          ok++;
          opt.classList.add('correct');
          if (fb) { fb.className = 'q-feedback show ok'; fb.textContent = '✓ 回答正确。' + explain; }
        } else {
          opt.classList.add('wrong');
          var right = qz.querySelector('.q-opt[data-key="' + answer + '"]');
          if (right) right.classList.add('correct');
          if (fb) { fb.className = 'q-feedback show no'; fb.textContent = '✗ 正确答案：' + answer + '。' + explain; }
        }
        updateScore();
      });
    });
  });

  /* ② 计分条（页面含 #scorebar 时启用） */
  var sb = document.getElementById('scorebar');
  function updateScore() {
    if (!sb) return;
    sb.querySelector('[data-sc="done"]').textContent = done;
    sb.querySelector('[data-sc="total"]').textContent = total;
    sb.querySelector('[data-sc="ok"]').textContent = ok;
    sb.querySelector('[data-sc="no"]').textContent = done - ok;
    var bar = sb.querySelector('.bar i');
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  }
  updateScore();

  /* ③ 默写模式：模糊所有 .blur-target，逐个点击回忆后揭示 */
  document.querySelectorAll('[data-recall-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = document.body.classList.toggle('recall');
      btn.textContent = on ? '✍️ 退出默写模式' : '✍️ 开启默写模式';
      document.querySelectorAll('.blur-target').forEach(function (el) {
        el.classList.remove('peek');
      });
    });
  });
  document.querySelectorAll('.blur-target').forEach(function (el) {
    el.addEventListener('click', function () {
      if (document.body.classList.contains('recall')) el.classList.add('peek');
    });
  });

  /* ④ 阅读进度条 */
  var rb = document.getElementById('readbar');
  if (rb) {
    var onScroll = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      rb.style.width = (max > 0 ? (h.scrollTop / max * 100) : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ⑤ 打印时展开全部分步揭示 */
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('details.step').forEach(function (d) { d.setAttribute('open', ''); });
  });
});
