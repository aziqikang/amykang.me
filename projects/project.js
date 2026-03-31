const ICONS = {
  github: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};

async function init() {
  // project.js lives one level above each project dir; data is relative to the HTML file
  const res = await fetch('data/project.json');
  const data = await res.json();

  document.title = `${data.title} – Amy Kang`;

  // Back link
  document.getElementById('back-link').href = data.backUrl ?? 'https://amykang.me';

  // Title
  document.getElementById('project-title').textContent = data.title.toLowerCase();

  // Links
  const linksEl = document.getElementById('project-links');
  (data.links ?? []).forEach(({ type, label, url }) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">${ICONS[type] ?? ''}<span>${label}</span></a>`;
    linksEl.appendChild(li);
  });

  // Body paragraphs — stored as an array of strings in JSON
  const bodyEl = document.getElementById('project-body');
  (data.body ?? []).forEach(para => {
    const p = document.createElement('p');
    p.textContent = para;
    bodyEl.appendChild(p);
  });
}

init().catch(err => console.error('Failed to load project data:', err));
