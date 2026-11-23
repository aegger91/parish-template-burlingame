// The one JSON block each page carries for site.js: services (for the
// schedule views, "next services" and the live badge), the feast calendar,
// livestream settings and the UI strings the browser needs, all already in
// the page's language.
import { raw } from '../lib/html.mjs';
import { featureEnabled } from '../lib/content.mjs';
import { allServices, serviceLabel, serviceType } from './service-times.mjs';
import { addressLines } from './contact.mjs';

const CLIENT_PREFIXES = [
  'a11y.', 'schedule.', 'calendar.', 'live.', 'form.', 'newsletter.', 'donate.', 'sermons.', 'filter.', 'gallery.',
  'cart.', 'checkout.', 'store.', 'requests.', 'zapiski.', 'oc.', 'contact.'
];

export function livestreamPage(ctx) {
  return ctx.content.pages.find((p) => p.requires === 'livestream');
}

export function clientData(ctx) {
  const { site, content } = ctx;
  const cal = site.calendar || {};
  const feast = (f) => ({ date: f.date, offset: f.offset, rank: f.rank, title: ctx.l(f.title) });
  const live = featureEnabled(site, 'livestream') ? site.livestream : null;
  const livePage = livestreamPage(ctx);
  const place = addressLines(ctx).join(', ');
  const data = {
    locale: ctx.locale,
    tz: site.timezone,
    weekStart: ctx.localeInfo.weekStart ?? cal.weekStart ?? 0,
    calendar: {
      style: ctx.calendarStyle,
      key: ctx.calendarStyleKey,
      showOldStyle: cal.showOldStyle !== false,
      label: ctx.calendarLabel()
    },
    parish: ctx.l(site.name),
    place: place,
    directionsUrl: site.contact?.directionsUrl || null,
    feasts: { fixed: (content.calendar.fixed || []).map(feast), movable: (content.calendar.movable || []).map(feast) },
    services: allServices(ctx).map((e) => {
      const type = serviceType(e, ctx);
      return {
        id: e.id,
        d: e.date,
        t: e.time || '',
        title: serviceLabel(e, ctx),
        note: ctx.l(e.note) || undefined,
        place: place,
        stream: live ? (e.stream ?? type?.streamed ?? false) : false,
        dur: e.durationMinutes || type?.durationMinutes || 90,
        none: e.noService || undefined
      };
    }),
    livestream: live
      ? { page: livePage ? ctx.pagePath(livePage.id) : null, watch: live.watchUrl || null, lead: live.leadMinutes ?? 15, statusUrl: live.statusUrl || null }
      : null,
    strings: Object.fromEntries(
      Object.keys(content.ui.strings)
        .filter((k) => CLIENT_PREFIXES.some((p) => k.startsWith(p)))
        .map((k) => [k, ctx.l(content.ui.strings[k])])
    )
  };
  return raw(`<script type="application/json" id="site-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}
