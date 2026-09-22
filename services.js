const services = [
  {no:'01',type:'COMPUTERS',title:'Laptop & Desktop Repair',image:'assets/product-computer.jpg',alt:'Laptop and desktop computer repair',items:['Tidak boleh hidup atau boot','Prestasi perlahan dan terlalu panas','RAM, storage, keyboard dan skrin','Motherboard dan power issue']},
  {no:'02',type:'PRINTERS',title:'Printer Troubleshooting',image:'assets/product-printer.jpg',alt:'Printer inspection and repair',items:['Paper jam dan masalah feeding','Print kabur, bergaris atau warna tidak tepat','Driver, Wi-Fi dan sambungan USB','Ink system, waste pad dan maintenance']},
  {no:'03',type:'HARDWARE',title:'Hardware Diagnosis',image:'assets/why-quality.jpg',alt:'Technician inspecting electronic components',items:['Pemeriksaan komponen rosak','Power supply dan charging issue','Port, kabel dan peripheral','Cadangan repair atau replacement']},
  {no:'04',type:'SOFTWARE',title:'Software Support',image:'assets/about-workspace.jpg',alt:'Computer software setup and support',items:['Windows dan driver installation','Software error dan application issue','Virus, malware dan security cleanup','Backup, restore dan data migration']},
  {no:'05',type:'NETWORKING',title:'Network & Connectivity',image:'assets/product-network.jpg',alt:'Network switch and ethernet troubleshooting',items:['Wi-Fi dan internet troubleshooting','Router, switch dan LAN setup','Printer sharing dan device connection','Home dan small-business networking']},
  {no:'06',type:'GENERAL SUPPORT',title:'Other IT Repairs',image:'assets/why-innovation.jpg',alt:'Electronic circuit board and technology service',items:['Pemeriksaan awal untuk peranti lain','Nasihat pembaikan atau penggantian','Sokongan aksesori dan sambungan','Hubungi kami jika masalah tidak tersenarai']}
];

const serviceCards = services.map(service => `
  <article class="service-card">
    <img src="${service.image}" alt="${service.alt}" loading="lazy">
    <div><span>${service.no} / ${service.type}</span><h2>${service.title}</h2><ul>${service.items.map(item => `<li>${item}</li>`).join('')}</ul></div>
  </article>`).join('');

document.body.innerHTML = `
  <div class="page-progress" id="pageProgress"></div>
  <div class="noise"></div>
  <header class="site-header scrolled" id="top">
    <div class="container nav-wrap">
      <a class="brand" href="index.html#home"><img src="assets/vitacom-logo.png" alt="Vitacom Enterprise logo"><span class="brand-name">Vitacom Enterprise</span></a>
      <button class="menu-btn" id="menuBtn" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="nav" id="navMenu"><a href="index.html#home">Home</a><a href="index.html#about">About</a><a href="products.html">Products</a><a class="active" href="services.html">Service & Troubleshooting</a><a href="index.html#why">Why Vitacom</a><a href="index.html#contact">Contact</a></nav>
      <a class="nav-cta desktop-only" href="https://api.whatsapp.com/send?phone=%2B60128646878" target="_blank" rel="noopener">Book Service</a>
    </div>
  </header>
  <main>
    <section class="service-hero">
      <div class="container service-hero-grid">
        <div class="service-hero-copy">
          <span class="eyebrow"><i></i> SERVICE & TROUBLESHOOTING</span>
          <h1>Hardware Or Software.<br><span>We’ll Help Diagnose It.</span></h1>
          <p>Vitacom menyediakan pemeriksaan, troubleshooting, pembaikan dan sokongan untuk laptop, desktop, printer, rangkaian serta masalah software dan hardware.</p>
          <div class="hero-actions"><a class="btn btn-primary" href="https://api.whatsapp.com/send?phone=%2B60128646878" target="_blank" rel="noopener">Ask for Diagnosis ↗</a><a class="btn btn-ghost" href="#service-list">View Services</a></div>
        </div>
        <div class="service-hero-photo"><img src="assets/why-reliability.jpg" alt="Technician diagnosing and repairing computer hardware"><span>DIAGNOSE · REPAIR · SUPPORT</span></div>
      </div>
    </section>
    <section class="service-list-section" id="service-list">
      <div class="container">
        <div class="section-head split"><div><span class="eyebrow dark"><i></i> WHAT WE CAN HELP WITH</span><h2>Complete Technical<br><span>Support.</span></h2></div><p>Bawa peranti atau hubungi pasukan Vitacom untuk semakan awal. Jenis pembaikan bergantung pada diagnosis dan ketersediaan alat ganti.</p></div>
        <div class="service-grid">${serviceCards}</div>
      </div>
    </section>
    <section class="service-process">
      <div class="container">
        <span class="eyebrow"><i></i> HOW IT WORKS</span>
        <div class="process-grid">
          <article><b>01</b><h2>Tell Us The Problem</h2><p>Hantar jenis peranti, simptom dan gambar jika ada melalui WhatsApp.</p></article>
          <article><b>02</b><h2>Diagnosis</h2><p>Vitacom akan periksa punca masalah dan cadangkan tindakan yang sesuai.</p></article>
          <article><b>03</b><h2>Repair & Test</h2><p>Pembaikan dibuat selepas persetujuan, kemudian peranti diuji sebelum diserahkan.</p></article>
        </div>
        <div class="service-cta"><div><span>Need technical help?</span><h2>Contact Vitacom for a service check.</h2></div><a class="btn btn-primary" href="https://api.whatsapp.com/send?phone=%2B60128646878" target="_blank" rel="noopener">WhatsApp +60 12-864 6878 ↗</a></div>
      </div>
    </section>
  </main>
  <footer class="footer compact-footer">
    <div class="container footer-statement"><div class="footer-mark"><img src="assets/vitacom-logo.png" alt=""><strong>VITACOM ENTERPRISE</strong></div><p>Hardware and software troubleshooting for homes and businesses in Melaka.</p></div>
    <div class="container footer-bottom"><span>© 2026 VITACOM ENTERPRISE · MERLIMAU, MELAKA</span></div>
  </footer>
  <button class="floating-whatsapp" aria-label="WhatsApp Vitacom" onclick="window.open('https://api.whatsapp.com/send?phone=%2B60128646878','_blank')"><span class="brand-icon brand-whatsapp" aria-hidden="true"><img src="assets/icons/whatsapp.png" alt="" width="40" height="40"></span><i>Chat with us</i></button>`;

const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
menuBtn.addEventListener('click', () => {
  const open = navMenu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
