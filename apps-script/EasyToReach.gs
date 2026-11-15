/**
 * EasyToReach — HAD Media outreach autopilot
 * Lives inside a Google Sheet. Finds leads, finds emails, writes openers,
 * sends a 3-step email sequence from your Gmail, stops on reply or bounce.
 */

var SHEETS = { SETTINGS: 'Settings', LEADS: 'Leads', TEMPLATES: 'Templates', LOG: 'Log', DASH: 'Dashboard' };

var LEAD_COLS = ['ID', 'Approve', 'Status', 'Source', 'Company', 'Website', 'Domain', 'Country', 'City',
  'Industry', 'What they do', 'Team size', 'Batch / Type', 'Contact name', 'Title', 'LinkedIn', 'Email',
  'Email source', 'Opener', 'Step', 'Last sent', 'Next send', 'Thread ID', 'Notes', 'Added'];

var STATUS = {
  NEW: 'New', NO_EMAIL: 'No email', READY: 'Ready', ACTIVE: 'In sequence', REPLIED: 'Replied',
  BOUNCED: 'Bounced', DONE: 'Finished', SKIP: 'Skip', ERROR: 'Error'
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 EasyToReach')
    .addItem('1. Set up (run once)', 'setup')
    .addSeparator()
    .addItem('Find new leads now', 'findLeads')
    .addItem('Find emails + write openers now', 'enrichLeads')
    .addItem('Send due emails now', 'sendDue')
    .addItem('Check replies + bounces now', 'checkReplies')
    .addItem('Run everything now', 'runAll')
    .addSeparator()
    .addItem('Send me a test email', 'sendTest')
    .addItem('Turn autopilot ON', 'installTriggers')
    .addItem('Turn autopilot OFF', 'removeTriggers')
    .addToUi();
}

/* ---------------- setup ---------------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  buildSettings_(ss);
  buildLeads_(ss);
  buildTemplates_(ss);
  buildLog_(ss);
  buildDashboard_(ss);
  installTriggers();
  log_('setup', 'Setup complete, autopilot on.');
  try { SpreadsheetApp.getUi().alert('EasyToReach is set up. Fill in the yellow cells on the Settings tab, then use the 🚀 menu or just let autopilot run.'); } catch (e) {}
}

function buildSettings_(ss) {
  var sh = ss.getSheetByName(SHEETS.SETTINGS) || ss.insertSheet(SHEETS.SETTINGS, 0);
  if (sh.getLastRow() > 1) return;
  var rows = [
    ['Setting', 'Value', 'What it does'],
    ['Your name', 'Hrudanshu', 'Used to sign emails'],
    ['Agency name', 'HAD Media', ''],
    ['Booking link', '', 'Calendly / booking page, used as {{link}} in templates'],
    ['Countries', 'United States of America, United Kingdom, Canada, United Arab Emirates', 'Lead countries (comma separated)'],
    ['Max team size', 10, 'Skip companies bigger than this'],
    ['Earliest batch year', 2024, 'YC batch year or later'],
    ['Industry keywords', '', 'Optional, comma separated (e.g. B2B, Manufacturing). Blank = all'],
    ['Leads per day', 25, 'New leads added each day'],
    ['Emails per day', 30, 'Gmail cap is ~100/day; stay low to protect your inbox'],
    ['Send hours (IST)', '14-22', 'Only send in this window (covers UK, Dubai and US working hours)'],
    ['Follow-up gap (days)', '3, 4', 'Days before follow-up 1 and follow-up 2'],
    ['Auto-approve', 'NO', 'NO = tick Approve on a lead before it gets emailed. YES = fully automatic'],
    ['Allow guessed emails', 'NO', 'YES = also use firstname@domain guesses (more bounces)'],
    ['Places searches', 'marketing agency Dubai\nmanufacturer Dubai\nreal estate developer Dubai\nskincare brand London\nfurniture manufacturer Toronto', 'Google Maps searches, one per line (needs Places key)'],
    ['Google Places API key', '', 'Optional: finds businesses in Dubai/UK/US/Canada from Google Maps'],
    ['Gemini API key', '', 'Optional, free at aistudio.google.com: writes a personal opener per lead'],
    ['Hunter API key', '', 'Optional, free 25/month at hunter.io: finds founder emails'],
    ['Test email to', Session.getActiveUser().getEmail() || '', 'Where test emails go']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#111111').setFontColor('#F3EBDD');
  sh.getRange(2, 2, rows.length - 1, 1).setBackground('#FFF4C2').setWrap(true);
  sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 420);
  sh.setFrozenRows(1);
}

function buildLeads_(ss) {
  var sh = ss.getSheetByName(SHEETS.LEADS) || ss.insertSheet(SHEETS.LEADS);
  if (sh.getLastRow() > 0) return;
  sh.getRange(1, 1, 1, LEAD_COLS.length).setValues([LEAD_COLS])
    .setFontWeight('bold').setBackground('#111111').setFontColor('#F3EBDD');
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  sh.getRange(2, col_('Approve'), 2000, 1).insertCheckboxes();
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(STATUS).map(function (k) { return STATUS[k]; }), true).build();
  sh.getRange(2, col_('Status'), 2000, 1).setDataValidation(rule);
  sh.setColumnWidth(col_('What they do'), 260); sh.setColumnWidth(col_('Opener'), 320);
  var r = sh.getRange('A2:Y2000');
  var colors = [[STATUS.REPLIED, '#D9F2D9'], [STATUS.BOUNCED, '#F8D7D7'], [STATUS.ACTIVE, '#E3ECFA'], [STATUS.READY, '#FFF4C2']];
  var rules = colors.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="' + c[0] + '"').setBackground(c[1]).setRanges([r]).build();
  });
  sh.setConditionalFormatRules(rules);
}

function buildTemplates_(ss) {
  var sh = ss.getSheetByName(SHEETS.TEMPLATES) || ss.insertSheet(SHEETS.TEMPLATES);
  if (sh.getLastRow() > 1) return;
  var rows = [
    ['Step', 'Subject', 'Body'],
    [1, 'Quick idea for {{company}}\'s socials',
      'Hi {{first_name}},\n\n{{opener}}\n\nI run {{agency}}, a small team that manages Instagram and LinkedIn for early-stage B2B companies, so founders can stay on product while the brand keeps showing up every week.\n\nFor a team your size that usually means 3 to 4 posts a week, founder-led LinkedIn content and a clean, consistent look.\n\nWorth a 15-minute chat? {{link}}\n\nBest,\n{{my_name}}\n{{agency}}'],
    [2, '', 'Hi {{first_name}}, just bumping this up in case it got buried. Happy to send 3 post ideas for {{company}} first, no strings attached. Want them?\n\n{{my_name}}'],
    [3, '', 'Hi {{first_name}}, last note from me. If social isn\'t a priority right now, no worries at all. If it becomes one, I\'m one reply away.\n\nAll the best with {{company}},\n{{my_name}}']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#111111').setFontColor('#F3EBDD');
  sh.getRange(2, 3, 3, 1).setWrap(true);
  sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 620);
  sh.getRange(6, 1).setValue('Placeholders: {{first_name}} {{company}} {{opener}} {{my_name}} {{agency}} {{link}} {{country}}. Follow-ups (steps 2-3) reply in the same email thread, so their subject is ignored.');
}

function buildLog_(ss) {
  var sh = ss.getSheetByName(SHEETS.LOG) || ss.insertSheet(SHEETS.LOG);
  if (sh.getLastRow() > 0) return;
  sh.getRange(1, 1, 1, 3).setValues([['Time', 'Action', 'Detail']]).setFontWeight('bold');
  sh.setColumnWidth(3, 600);
}

function buildDashboard_(ss) {
  var sh = ss.getSheetByName(SHEETS.DASH) || ss.insertSheet(SHEETS.DASH, 0);
  sh.clear();
  var L = "Leads!C:C";
  var rows = [
    ['EasyToReach dashboard', ''],
    ['Total leads', '=COUNTA(Leads!A2:A)'],
    ['Waiting for approval', '=COUNTIF(' + L + ',"' + STATUS.READY + '")'],
    ['In sequence', '=COUNTIF(' + L + ',"' + STATUS.ACTIVE + '")'],
    ['Replied', '=COUNTIF(' + L + ',"' + STATUS.REPLIED + '")'],
    ['Finished, no reply', '=COUNTIF(' + L + ',"' + STATUS.DONE + '")'],
    ['Bounced', '=COUNTIF(' + L + ',"' + STATUS.BOUNCED + '")'],
    ['No email found', '=COUNTIF(' + L + ',"' + STATUS.NO_EMAIL + '")'],
    ['Reply rate', '=IFERROR(B5/(B4+B5+B6),0)'],
    ['Emails sent today', '=COUNTIFS(Log!B:B,"sent",Log!A:A,">="&TODAY())']
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange('A1').setFontSize(18).setFontWeight('bold');
  sh.getRange('B9').setNumberFormat('0.0%');
  sh.getRange('A2:A10').setFontWeight('bold');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 140);
}

/* ---------------- triggers ---------------- */

function installTriggers() {
  removeTriggers(true);
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(9).inTimezone('Asia/Kolkata').create();
  ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
  log_('autopilot', 'ON');
}

function removeTriggers(silent) {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  if (silent !== true) log_('autopilot', 'OFF');
}

function dailyJob() { findLeads(); enrichLeads(); }
function hourlyJob() { checkReplies(); enrichLeads(); sendDue(); }
function runAll() { findLeads(); enrichLeads(); checkReplies(); sendDue(); }

/* ---------------- helpers ---------------- */

function settings_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.SETTINGS);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var s = {};
  vals.forEach(function (r) { s[String(r[0]).trim()] = r[1]; });
  return s;
}

function yes_(v) { return String(v).trim().toUpperCase().indexOf('Y') === 0; }
function list_(v) { return String(v || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(String); }
function col_(name) { return LEAD_COLS.indexOf(name) + 1; }

function leadsSheet_() { return SpreadsheetApp.getActive().getSheetByName(SHEETS.LEADS); }

function readLeads_() {
  var sh = leadsSheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sh.getRange(2, 1, n, LEAD_COLS.length).getValues();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    LEAD_COLS.forEach(function (c, j) { o[c] = r[j]; });
    return o;
  }).filter(function (o) { return o.ID; });
}

function writeLead_(lead) {
  var row = LEAD_COLS.map(function (c) { return lead[c] === undefined ? '' : lead[c]; });
  leadsSheet_().getRange(lead._row, 1, 1, row.length).setValues([row]);
}

function appendLeads_(leads) {
  if (!leads.length) return;
  var sh = leadsSheet_();
  var start = lastDataRow_(sh) + 1;
  var rows = leads.map(function (l) { return LEAD_COLS.map(function (c) { return l[c] === undefined ? '' : l[c]; }); });
  sh.getRange(start, 1, rows.length, LEAD_COLS.length).setValues(rows);
  sh.getRange(start, col_('Approve'), rows.length, 1).insertCheckboxes();
}

function lastDataRow_(sh) {
  var ids = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i][0] !== '') return i + 1;
  return 1;
}

function domainOf_(url) {
  if (!url) return '';
  var m = String(url).toLowerCase().match(/^(?:https?:\/\/)?(?:www\.)?([^\/?#:]+)/);
  return m ? m[1] : '';
}

function log_(action, detail) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG);
  if (sh) sh.appendRow([new Date(), action, String(detail).slice(0, 4000)]);
}

function fetch_(url, opts) {
  opts = opts || {};
  opts.muteHttpExceptions = true;
  opts.followRedirects = true;
  opts.headers = opts.headers || {};
  if (!opts.headers['User-Agent']) opts.headers['User-Agent'] = 'Mozilla/5.0 (compatible; EasyToReach/1.0)';
  try {
    var r = UrlFetchApp.fetch(url, opts);
    return { code: r.getResponseCode(), text: r.getContentText() };
  } catch (e) {
    return { code: 0, text: '' };
  }
}

function timeLeft_(start) { return 300000 - (Date.now() - start); } // stay under the 6-min limit
/* ---------------- lead finding ---------------- */

/**
 * Adds up to "Leads per day" fresh, de-duplicated leads.
 * Sources: Y Combinator's public company directory (free) and, when a key is set,
 * Google Maps Places search (great for Dubai and local businesses).
 */
function findLeads() {
  var s = settings_();
  var want = Number(s['Leads per day']) || 25;
  var existing = readLeads_();
  var seenIds = {}, seenDomains = {};
  existing.forEach(function (l) { seenIds[l.ID] = 1; if (l.Domain) seenDomains[l.Domain] = 1; });

  var usePlaces = !!String(s['Google Places API key'] || '').trim() && list_(s['Places searches']).length;
  var ycWant = usePlaces ? Math.ceil(want / 2) : want;

  var fresh = [];
  try { fresh = fresh.concat(findYc_(s, ycWant, seenIds, seenDomains)); }
  catch (e) { log_('error', 'YC search: ' + e); }
  if (usePlaces) {
    try { fresh = fresh.concat(findPlaces_(s, want - fresh.length, seenIds, seenDomains)); }
    catch (e) { log_('error', 'Places search: ' + e); }
  }
  if (fresh.length < want) {
    try { fresh = fresh.concat(findYc_(s, want - fresh.length, seenIds, seenDomains)); } catch (e) {}
  }
  appendLeads_(fresh);
  log_('leads', 'Added ' + fresh.length + ' new leads');
  return fresh.length;
}

var COUNTRY_ALIASES = {
  'us': 'United States of America', 'usa': 'United States of America', 'united states': 'United States of America',
  'uk': 'United Kingdom', 'england': 'United Kingdom', 'great britain': 'United Kingdom',
  'uae': 'United Arab Emirates', 'dubai': 'United Arab Emirates', 'canada': 'Canada'
};

function normCountry_(c) {
  var k = String(c).trim().toLowerCase();
  return COUNTRY_ALIASES[k] || String(c).trim();
}

function findYc_(s, want, seenIds, seenDomains) {
  if (want <= 0) return [];
  var countries = list_(s['Countries']).map(normCountry_);
  var maxTeam = Number(s['Max team size']) || 10;
  var minYear = Number(s['Earliest batch year']) || 2024;
  var kws = list_(s['Industry keywords']).map(function (k) { return k.toLowerCase(); });
  var thisYear = new Date().getFullYear();
  var seasons = ['fall', 'summer', 'spring', 'winter']; // newest first within a year
  var out = [];

  for (var y = thisYear + 1; y >= minYear && out.length < want; y--) {
    for (var si = 0; si < seasons.length && out.length < want; si++) {
      var slug = seasons[si] + '-' + y;
      var cacheKey = 'yc_' + slug;
      var cached = CacheService.getScriptCache().get(cacheKey);
      var list;
      if (cached === 'none') continue;
      var r = fetch_('https://yc-oss.github.io/api/batches/' + slug + '.json');
      if (r.code !== 200) { CacheService.getScriptCache().put(cacheKey, 'none', 21600); continue; }
      try { list = JSON.parse(r.text); } catch (e) { continue; }

      for (var i = 0; i < list.length && out.length < want; i++) {
        var c = list[i];
        var id = 'yc:' + c.slug;
        var dom = domainOf_(c.website);
        if (seenIds[id] || !dom || seenDomains[dom]) continue;
        if (c.status && c.status !== 'Active') continue;
        if (c.team_size && c.team_size > maxTeam) continue;
        var regions = c.regions || [];
        var country = countries.filter(function (k) { return regions.indexOf(k) > -1; })[0];
        if (!country) continue;
        if (kws.length) {
          var hay = ((c.industries || []).join(' ') + ' ' + (c.tags || []).join(' ') + ' ' + c.one_liner + ' ' + c.long_description).toLowerCase();
          if (!kws.some(function (k) { return hay.indexOf(k) > -1; })) continue;
        }
        seenIds[id] = 1; seenDomains[dom] = 1;
        out.push({
          ID: id, Approve: false, Status: STATUS.NEW, Source: 'YC directory', Company: c.name,
          Website: c.website, Domain: dom, Country: country, City: String(c.all_locations || '').split(';')[0],
          Industry: (c.industries || []).join(', '), 'What they do': c.one_liner || '',
          'Team size': c.team_size || '', 'Batch / Type': c.batch, Notes: c.url, Added: new Date()
        });
      }
    }
  }
  return out;
}

function findPlaces_(s, want, seenIds, seenDomains) {
  if (want <= 0) return [];
  var key = String(s['Google Places API key']).trim();
  var queries = String(s['Places searches']).split('\n').map(function (q) { return q.trim(); }).filter(String);
  var props = PropertiesService.getScriptProperties();
  var out = [];
  var guard = 0;

  while (out.length < want && guard++ < queries.length * 3) {
    var qi = Number(props.getProperty('places_q') || 0) % queries.length;
    var q = queries[qi];
    var token = props.getProperty('places_tok_' + qi) || '';
    if (token === 'DONE') { props.setProperty('places_q', String(qi + 1)); continue; }

    var body = { textQuery: q, pageSize: 20 };
    if (token) body.pageToken = token;
    var r = fetch_('https://places.googleapis.com/v1/places:searchText', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.primaryTypeDisplayName,places.nationalPhoneNumber,nextPageToken'
      }
    });
    if (r.code !== 200) { log_('error', 'Places ' + r.code + ': ' + r.text.slice(0, 300)); break; }
    var j = JSON.parse(r.text);
    props.setProperty('places_tok_' + qi, j.nextPageToken || 'DONE');
    if (!j.nextPageToken) props.setProperty('places_q', String(qi + 1));

    (j.places || []).forEach(function (p) {
      if (out.length >= want) return;
      var id = 'gp:' + p.id;
      var dom = domainOf_(p.websiteUri);
      if (seenIds[id] || !dom || seenDomains[dom]) return;
      if (/facebook|instagram|linkedin|wa\.me|linktr|google\./.test(dom)) return;
      var addr = p.formattedAddress || '';
      var parts = addr.split(/,| - /).map(function (x) { return x.trim(); }).filter(String);
      seenIds[id] = 1; seenDomains[dom] = 1;
      out.push({
        ID: id, Approve: false, Status: STATUS.NEW, Source: 'Google Maps: ' + q, Company: (p.displayName || {}).text,
        Website: p.websiteUri, Domain: dom, Country: normCountry_(parts[parts.length - 1] || ''),
        City: parts.length > 1 ? parts[parts.length - 2] : '', Industry: (p.primaryTypeDisplayName || {}).text || '',
        'Batch / Type': 'Local business', Notes: p.nationalPhoneNumber ? 'Phone: ' + p.nationalPhoneNumber : '', Added: new Date()
      });
    });
  }
  return out;
}
/* ---------------- enrichment: contact, email, opener ---------------- */

var JUNK_EMAIL = /(example\.|sentry|wixpress|domain\.com|email\.com|yourname|@2x|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|noreply|no-reply|privacy|abuse|webmaster|postmaster|gdpr|legal|careers|jobs)/i;
var GOOD_PREFIX = ['founder', 'founders', 'ceo', 'hello', 'hi', 'team', 'contact', 'info', 'partnerships', 'marketing', 'sales', 'enquiries', 'inquiries', 'office'];

function enrichLeads() {
  var start = Date.now();
  var s = settings_();
  var leads = readLeads_().filter(function (l) { return l.Status === STATUS.NEW; });
  var done = 0;
  for (var i = 0; i < leads.length; i++) {
    if (timeLeft_(start) < 40000) break;
    var l = leads[i];
    try {
      enrichOne_(l, s);
    } catch (e) {
      l.Status = STATUS.ERROR; l.Notes = String(l.Notes || '') + ' | ' + e;
    }
    writeLead_(l);
    done++;
  }
  if (done) log_('enrich', 'Processed ' + done + ' leads');
}

function enrichOne_(l, s) {
  // 1. Founder from the YC company page
  if (String(l.ID).indexOf('yc:') === 0 && !l['Contact name']) {
    var f = ycFounder_(l.Notes || ('https://www.ycombinator.com/companies/' + l.ID.slice(3)));
    if (f) { l['Contact name'] = f.name; l.Title = f.title; l.LinkedIn = f.linkedin; }
  }

  // 2. Website text + emails
  var site = scrapeSite_(l.Website, l.Domain);
  var first = firstName_(l['Contact name']);
  var last = lastName_(l['Contact name']);
  var email = pickEmail_(site.emails, l.Domain, first, last);
  var src = email ? 'Website' : '';

  // 3. Hunter for a named founder when the site only gave a generic inbox
  var hunterKey = String(s['Hunter API key'] || '').trim();
  if (hunterKey && first && last && (!email || GOOD_PREFIX.indexOf(email.split('@')[0]) > -1)) {
    var h = fetch_('https://api.hunter.io/v2/email-finder?domain=' + encodeURIComponent(l.Domain) +
      '&first_name=' + encodeURIComponent(first) + '&last_name=' + encodeURIComponent(last) + '&api_key=' + hunterKey);
    if (h.code === 200) {
      var hd = JSON.parse(h.text).data || {};
      if (hd.email && (hd.score || 0) >= 70) { email = hd.email.toLowerCase(); src = 'Hunter (' + hd.score + '%)'; }
    }
  }

  // 4. Optional guess
  if (!email && first && yes_(s['Allow guessed emails'])) {
    email = first.toLowerCase().replace(/[^a-z]/g, '') + '@' + l.Domain;
    src = 'Guessed';
  }

  l.Email = email || '';
  l['Email source'] = src;

  // 5. Personal opener
  l.Opener = writeOpener_(l, site.text, s);

  if (l.Email) {
    l.Status = STATUS.READY;
    l.Step = 0;
    if (yes_(s['Auto-approve'])) l.Approve = true;
  } else {
    l.Status = STATUS.NO_EMAIL;
  }
}

function ycFounder_(url) {
  var r = fetch_(url);
  if (r.code !== 200) return null;
  var m = r.text.match(/data-page="([^"]+)"/);
  if (!m) return null;
  var json = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  try {
    var page = JSON.parse(json);
    var fs = (page.props.company || {}).founders || [];
    if (!fs.length) return null;
    var ceo = fs.filter(function (f) { return /ceo/i.test(f.title || ''); })[0] || fs[0];
    return { name: ceo.full_name || '', title: ceo.title || 'Founder', linkedin: ceo.linkedin_url || '' };
  } catch (e) { return null; }
}

function scrapeSite_(website, domain) {
  var base = 'https://' + domain;
  var pages = [website || base, base + '/contact', base + '/contact-us', base + '/about'];
  var emails = {}, text = '';
  pages.forEach(function (u, idx) {
    var r = fetch_(u);
    if (r.code !== 200 || !r.text) return;
    var html = r.text.slice(0, 400000);
    var found = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    found.forEach(function (e) {
      e = e.toLowerCase().replace(/^mailto:/, '').replace(/\.$/, '');
      if (!JUNK_EMAIL.test(e)) emails[e] = 1;
    });
    if (idx === 0) {
      text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    }
  });
  return { emails: Object.keys(emails), text: text };
}

function pickEmail_(emails, domain, first, last) {
  var root = domain.split('.').slice(-2).join('.');
  var own = emails.filter(function (e) { return e.split('@')[1] && e.split('@')[1].indexOf(root) > -1; });
  var pool = own.length ? own : emails.filter(function (e) { return !/gmail|yahoo|hotmail|outlook/.test(e) || emails.length === 1; });
  if (!pool.length) return '';
  var f = (first || '').toLowerCase(), la = (last || '').toLowerCase();
  if (f) {
    var personal = pool.filter(function (e) { var u = e.split('@')[0]; return u.indexOf(f) > -1 || (la && u.indexOf(la) > -1); })[0];
    if (personal) return personal;
  }
  for (var i = 0; i < GOOD_PREFIX.length; i++) {
    var hit = pool.filter(function (e) { return e.split('@')[0] === GOOD_PREFIX[i]; })[0];
    if (hit) return hit;
  }
  return pool[0];
}

function firstName_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function lastName_(n) { var p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[p.length - 1] : ''; }

function writeOpener_(l, siteText, s) {
  var key = String(s['Gemini API key'] || '').trim();
  if (key) {
    var prompt = 'Write ONE short, specific, genuine opening sentence (max 30 words) for a cold email to ' +
      (l['Contact name'] || 'the founder') + ' at ' + l.Company + '. Mention something concrete about what they do. ' +
      'No flattery cliches, no "I came across", no questions, no emojis, no greeting, plain English. Output only the sentence.\n\n' +
      'Company: ' + l.Company + '\nWhat they do: ' + (l['What they do'] || '') + '\nIndustry: ' + (l.Industry || '') +
      '\nLocation: ' + (l.City || '') + ' ' + (l.Country || '') + '\nWebsite text: ' + (siteText || '').slice(0, 2000);
    var r = fetch_('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } } })
    });
    if (r.code === 200) {
      try {
        var t = JSON.parse(r.text).candidates[0].content.parts[0].text.trim().replace(/^"|"$/g, '');
        if (t) return t;
      } catch (e) {}
    } else {
      log_('error', 'Gemini ' + r.code + ': ' + r.text.slice(0, 200));
    }
  }
  var what = String(l['What they do'] || '').replace(/\.$/, '');
  if (what) return 'Saw what you\'re building at ' + l.Company + ' (' + (/^[A-Z][a-z]/.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : what) + ') and had a thought about how it shows up on social.';
  return 'I was looking at ' + l.Company + '\'s site and had a thought about how the brand shows up on social.';
}
/* ---------------- sending + reply tracking ---------------- */

function templates_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.TEMPLATES);
  var vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 3).getValues();
  var t = {};
  vals.forEach(function (r) { var n = Number(r[0]); if (n >= 1 && String(r[2]).trim()) t[n] = { subject: String(r[1]), body: String(r[2]) }; });
  return t;
}

function fill_(text, l, s) {
  var map = {
    first_name: firstName_(l['Contact name']) || 'there',
    company: l.Company || 'your company',
    opener: l.Opener || '',
    my_name: s['Your name'] || '',
    agency: s['Agency name'] || '',
    link: s['Booking link'] || '',
    country: l.Country || ''
  };
  var out = String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return map[k] !== undefined ? map[k] : ''; });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function toHtml_(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
}

function inWindow_(s) {
  var m = String(s['Send hours (IST)'] || '14-22').match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return true;
  var h = Number(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'H'));
  return h >= Number(m[1]) && h < Number(m[2]);
}

function sentTodayKey_() { return 'sent_' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }

function gaps_(s) {
  var g = list_(s['Follow-up gap (days)']).map(Number);
  return { 2: g[0] || 3, 3: g[1] || g[0] || 4 };
}

function sendDue(force) {
  var start = Date.now();
  var s = settings_();
  if (force !== true && !inWindow_(s)) return;
  var props = PropertiesService.getScriptProperties();
  var cap = Number(s['Emails per day']) || 30;
  var sent = Number(props.getProperty(sentTodayKey_()) || 0);
  var perRun = Math.max(1, Math.ceil(cap / 6)); // spread sends across the window
  var t = templates_();
  if (!t[1]) { log_('error', 'Template step 1 is empty'); return; }
  var maxStep = Math.max.apply(null, Object.keys(t).map(Number));
  var now = new Date();
  var thisRun = 0;

  var leads = readLeads_();
  // follow-ups first, then new first emails
  var due = leads.filter(function (l) { return l.Status === STATUS.ACTIVE && l['Next send'] && new Date(l['Next send']) <= now; })
    .concat(leads.filter(function (l) { return l.Status === STATUS.READY && l.Approve === true && l.Email; }));

  for (var i = 0; i < due.length; i++) {
    if (sent >= cap || thisRun >= perRun || timeLeft_(start) < 30000) break;
    var l = due[i];
    var step = Number(l.Step || 0) + 1;
    try {
      if (step > maxStep) { l.Status = STATUS.DONE; l['Next send'] = ''; writeLead_(l); continue; }
      if (step > 1 && hasReply_(l['Thread ID'])) { l.Status = STATUS.REPLIED; l['Next send'] = ''; writeLead_(l); continue; }

      var tpl = t[step];
      var body = fill_(tpl.body, l, s);
      var opts = { name: (s['Your name'] ? s['Your name'] + ' | ' : '') + (s['Agency name'] || ''), htmlBody: toHtml_(body) };

      if (step === 1) {
        var subject = fill_(tpl.subject, l, s);
        var msg = GmailApp.createDraft(l.Email, subject, body, opts).send();
        l['Thread ID'] = msg.getThread().getId();
      } else {
        var thread = GmailApp.getThreadById(l['Thread ID']);
        var msgs = thread.getMessages();
        msgs[msgs.length - 1].replyAll(body, opts);
      }

      l.Step = step;
      l['Last sent'] = now;
      var next = t[step + 1] ? gaps_(s)[step + 1] : null;
      if (next) { l.Status = STATUS.ACTIVE; l['Next send'] = new Date(now.getTime() + next * 86400000); }
      else { l.Status = STATUS.DONE; l['Next send'] = ''; }
      writeLead_(l);
      sent++; thisRun++;
      props.setProperty(sentTodayKey_(), String(sent));
      log_('sent', 'Step ' + step + ' to ' + l.Email + ' (' + l.Company + ')');
      Utilities.sleep(2000 + Math.floor(Math.random() * 4000));
    } catch (e) {
      l.Status = STATUS.ERROR; l.Notes = String(l.Notes || '') + ' | send: ' + e;
      writeLead_(l);
      log_('error', 'Send to ' + l.Email + ': ' + e);
    }
  }
}

function myAddresses_() {
  var me = [Session.getEffectiveUser().getEmail().toLowerCase()];
  try { GmailApp.getAliases().forEach(function (a) { me.push(a.toLowerCase()); }); } catch (e) {}
  return me;
}

function hasReply_(threadId, me) {
  if (!threadId) return false;
  me = me || myAddresses_();
  var thread;
  try { thread = GmailApp.getThreadById(threadId); } catch (e) { return false; }
  if (!thread) return false;
  return thread.getMessages().some(function (m) {
    var from = m.getFrom().toLowerCase();
    return !me.some(function (a) { return from.indexOf(a) > -1; }) && !/mailer-daemon|postmaster/.test(from);
  });
}

function checkReplies() {
  var start = Date.now();
  var me = myAddresses_();
  var leads = readLeads_();
  var cutoff = Date.now() - 30 * 86400000;
  var replied = 0, bounced = 0;

  // bounces
  var bounceText = '';
  try {
    GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:4d', 0, 50).forEach(function (th) {
      th.getMessages().forEach(function (m) { bounceText += ' ' + m.getPlainBody().toLowerCase(); });
    });
  } catch (e) {}

  for (var i = 0; i < leads.length; i++) {
    if (timeLeft_(start) < 20000) break;
    var l = leads[i];
    var watch = l.Status === STATUS.ACTIVE || (l.Status === STATUS.DONE && l['Last sent'] && new Date(l['Last sent']).getTime() > cutoff);
    if (!watch) continue;
    if (l.Email && bounceText.indexOf(String(l.Email).toLowerCase()) > -1) {
      l.Status = STATUS.BOUNCED; l['Next send'] = ''; writeLead_(l); bounced++; continue;
    }
    if (hasReply_(l['Thread ID'], me)) {
      l.Status = STATUS.REPLIED; l['Next send'] = ''; writeLead_(l); replied++;
      try { GmailApp.getThreadById(l['Thread ID']).markImportant().addLabel(replyLabel_()); } catch (e) {}
    }
  }
  if (replied || bounced) log_('replies', replied + ' new replies, ' + bounced + ' bounces');
}

function replyLabel_() {
  return GmailApp.getUserLabelByName('EasyToReach/Replied') || GmailApp.createLabel('EasyToReach/Replied');
}

function sendTest() {
  var s = settings_();
  var to = String(s['Test email to'] || Session.getEffectiveUser().getEmail());
  var t = templates_();
  var fake = { 'Contact name': 'Alex Founder', Company: 'Acme Robotics', Opener: 'Saw Acme is shipping warehouse robots to mid-size UK manufacturers, which is a story that plays really well on LinkedIn.', Country: 'United Kingdom' };
  var body = fill_(t[1].body, fake, s);
  var opts = { name: (s['Your name'] ? s['Your name'] + ' | ' : '') + (s['Agency name'] || ''), htmlBody: toHtml_(body) };
  var msg = GmailApp.createDraft(to, '[TEST] ' + fill_(t[1].subject, fake, s), body, opts).send();
  if (t[2]) {
    Utilities.sleep(3000);
    var b2 = fill_(t[2].body, fake, s);
    var th = msg.getThread().getMessages();
    th[th.length - 1].replyAll(b2, { name: opts.name, htmlBody: toHtml_(b2) });
  }
  log_('test', 'Test email + follow-up sent to ' + to);
  try { SpreadsheetApp.getUi().alert('Test sent to ' + to + '. You should see the first email and a follow-up in the same thread.'); } catch (e) {}
}
