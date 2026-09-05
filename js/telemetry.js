// Privacy-conscious PostHog instrumentation for the ABC Tutoring study prototype.
// The project token is intentionally configured in js/site-data.js because PostHog project tokens are client-side tokens.
// No parent/student names, emails, form values, or other direct identifiers are sent by this wrapper.
(function () {
  const site = window.ABC_SITE || {};
  const cfg = site.posthog || {};
  const debugEvents = [];
  const blockedProperty = /(name|email|student|parent|guardian|phone|address|notes|message)/i;

  function sanitize(properties) {
    const clean = { ...(properties || {}) };
    Object.keys(clean).forEach((key) => {
      if (blockedProperty.test(key)) delete clean[key];
    });
    clean.$process_person_profile = false;
    return clean;
  }

  window.ABC_TELEMETRY = {
    configured: false,
    debugEvents,
    capture(eventName, properties) {
      const safeProperties = sanitize(properties);
      debugEvents.push({ event: eventName, properties: safeProperties, at: new Date().toISOString() });
      if (window.posthog && this.configured && typeof window.posthog.capture === 'function') {
        window.posthog.capture(eventName, safeProperties);
      } else if (cfg.debug) {
        console.info('[ABC telemetry debug]', eventName, safeProperties);
      }
    }
  };

  if (!cfg.enabled) return;

  const token = String(cfg.projectToken || '');
  const tokenIsConfigured = token && !token.includes('REPLACE_WITH');
  if (!tokenIsConfigured) {
    console.info('[ABC Tutoring] PostHog is instrumented but no project token is configured. Events remain in window.ABC_TELEMETRY.debugEvents.');
    return;
  }

  // PostHog's recommended browser snippet, initialized with privacy-restrictive settings for this K–12 site.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(token, {
    api_host: cfg.apiHost || 'https://us.i.posthog.com',
    defaults: '2026-08-30',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: 'never',
    persistence: 'sessionStorage',
    respect_dnt: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: function (event) {
      if (!event || !event.properties) return event;
      Object.keys(event.properties).forEach((key) => {
        if (blockedProperty.test(key)) delete event.properties[key];
      });
      event.properties.$process_person_profile = false;
      return event;
    },
    loaded: function () {
      window.ABC_TELEMETRY.configured = true;
      if (cfg.debug) posthog.debug();
    }
  });
})();
