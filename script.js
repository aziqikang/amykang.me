const ICONS = {
  github: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  email: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>`,
};

async function init() {
  const res = await fetch('data/resume.json');
  const data = await res.json();

  document.title = data.name;
  document.getElementById('name').textContent = data.name.toLowerCase();

  // Social links
  const nav = document.getElementById('social-links');
  data.social.forEach(({ type, label, url }) => {
    const li = document.createElement('li');
    const isExternal = type !== 'email';
    li.innerHTML = `<a href="${url}"${isExternal ? ' target="_blank" rel="noopener"' : ''}>${ICONS[type] ?? ''}<span>${label}</span></a>`;
    nav.appendChild(li);
  });

  // Bio paragraphs
  const bioEl = document.getElementById('bio');
  data.bio.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    bioEl.appendChild(p);
  });

  // Resume sections
  const main = document.getElementById('sections');
  data.sections.forEach(section => {
    const sec = document.createElement('section');
    sec.className = 'section';
    sec.id = section.id;

    const h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.textContent = section.title;
    sec.appendChild(h2);

    section.entries.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'entry';

      const subtitleHtml = entry.subtitle
        ? entry.subtitleLink
          ? `<a class="entry-subtitle" href="${entry.subtitleLink}">${entry.subtitle}</a>`
          : `<span class="entry-subtitle">${entry.subtitle}</span>`
        : '';

      const titleInner = entry.link
        ? `<a class="entry-link" href="${entry.link}">${entry.title}</a>${subtitleHtml}`
        : `${entry.title}${subtitleHtml}`;

      div.innerHTML = `
        <div class="entry-date">${entry.date}</div>
        <div class="entry-title">${titleInner}</div>
      `;
      sec.appendChild(div);
    });

    main.appendChild(sec);
  });

  // Art promo
  document.getElementById('art-promo').innerHTML =
    `have some time? check out some cool art <a href="${data.artLink}" target="_blank" rel="noopener">HERE</a>`;
}

init().catch(err => console.error('Failed to load resume data:', err));
