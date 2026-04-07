const SITE_NAMES = [
  'facebook', 'www.facebook', 'fb.com',
  'twitter', 'www.twitter', 'x.com', 'www.x.com',
  'reddit', 'www.reddit', 'old.reddit',
  'instagram', 'www.instagram',
  'linkedin', 'www.linkedin',
  'github', 'www.github',
  'stackoverflow', 'www.stackoverflow',
  'stackexchange', 'www.stackexchange',
  'medium', 'www.medium',
  'quora', 'www.quora',
  'wikipedia', 'www.wikipedia',
  'amazon', 'www.amazon',
  'netflix', 'www.netflix',
  'twitch', 'www.twitch',
  'discord', 'www.discord',
  'slack', 'www.slack',
  'notion', 'www.notion',
  'figma', 'www.figma',
  'jira', 'www.jira',
  'gitlab', 'www.gitlab',
  'bitbucket', 'www.bitbucket',
  'dev.to', 'www.dev.to',
  'hackernews', 'news.ycombinator',
  'producthunt', 'www.producthunt',
  'craigslist', 'www.craigslist',
  'ebay', 'www.ebay',
  'spotify', 'open.spotify',
  'soundcloud', 'www.soundcloud',
  'vimeo', 'www.vimeo',
  'dribbble', 'www.dribbble',
  'behance', 'www.behance',
  'codepen', 'www.codepen',
  'replit', 'www.replit',
  'glitch', 'www.glitch',
  'jsfiddle', 'www.jsfiddle',
  'stackblitz', 'www.stackblitz'
];

const TITLE_SEPARATORS = [
  ' - ', ' : ', ' | ', ' — ', ' – ', ' :: ', ' /// ',
  ' on ', ' - ', ': ', '| '
];

function cleanTitle(title) {
  if (!title) return '';
  
  let cleaned = title.toLowerCase().trim();
  
  for (const sep of TITLE_SEPARATORS) {
    const idx = cleaned.lastIndexOf(sep);
    if (idx > 5) {
      cleaned = cleaned.substring(0, idx).trim();
    }
  }
  
  const words = cleaned.split(/\s+/);
  const filtered = words.filter(word => {
    const domainWord = word.replace(/[^a-z0-9]/g, '');
    return !SITE_NAMES.includes(domainWord) && 
           !SITE_NAMES.includes('www.' + domainWord);
  });
  
  cleaned = filtered.join(' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

export { cleanTitle, SITE_NAMES, TITLE_SEPARATORS };