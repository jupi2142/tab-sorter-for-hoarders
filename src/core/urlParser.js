function getHostname(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return null;
  }
  try {
    return new URL(tab.url).hostname;
  } catch (e) {
    return null;
  }
}

function getDomainKey(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return '\uffff';
  }

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    
    let domain;
    
    if (parts.length >= 2) {
      domain = parts.slice(-2).join('.');
    } else {
      domain = hostname;
    }

    const path = url.pathname + url.search;
    
    return `${domain}\0${path}`;
  } catch (e) {
    return '\uffff';
  }
}

function getSubdomainKey(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return '\uffff';
  }

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    
    let domain, subdomain;
    
    if (parts.length >= 2) {
      domain = parts.slice(-2).join('.');
      subdomain = parts.slice(0, -2).join('.');
    } else {
      domain = hostname;
      subdomain = '';
    }

    const path = url.pathname + url.search;
    
    return `${domain}\0${subdomain}\0${path}`;
  } catch (e) {
    return '\uffff';
  }
}

export { getHostname, getDomainKey, getSubdomainKey };