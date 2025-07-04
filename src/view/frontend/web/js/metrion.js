document.addEventListener('DOMContentLoaded', function () {
    fetch('/rest/V1/metrion/config')
        .then(response => response.json())
        .then(config => {
            config = config[0];
            if (!config.enable_metrion_module) {
                return;
            }
            window.metrion = {
                configuration: {
                    metrion_retrieved_store_id: config.store_id ?? '1',
                    user_cookie_name: config.user_cookie_name ? `${config.user_cookie_name}_js` : "me_uid_js",
                    user_cookie_lifetime_milliseconds: Number(config.user_cookie_expiration ? (config.user_cookie_expiration * 86400000) : 31536000000),
                    session_cookie_name: config.session_cookie_name ? config.session_cookie_name : "me_sid",
                    session_cookie_lifetime_milliseconds: Number(config.session_cookie_expiration ? (config.session_cookie_expiration * 60000) : 2592000000),
                    cookie_separator: "--",
                    event_endpoint: `${window.location.origin}/rest/all/V1/metrion/stream`,
                    session_start_trigger: false,
                    session_start_reasons: [],
                    browser_support_safe_uuid: true,
                    debug_mode: false,
                    consent_cookie_name: config.consent_cookie_name ? config.consent_cookie_name : "me_consent",
                    cmp_selection: config.cmp_selection ? config.cmp_selection : "no_cmp",
                    consent_config: config.consent_config ? config.consent_config : {},
                    session_info_storage_name: "mtrn_session_info",
                    event_broker_queue: [],
                    floodgate_name: config.floodgate_name ? config.floodgate_name : "me_floodgate",
                    floodgate_open: false,
                    purchase_only_tracking: true,
                    base_config: config
                },

                user_manager: {
                    user_cookie_exists: function () {
                        var configuration = window.metrion.configuration;

                        return window.metrion.helpers.get_cookie_value(configuration.user_cookie_name) !== null;
                    },

                    is_user_cookie_expired: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.user_manager.user_cookie_exists()) {
                            return true;
                        }

                        var user_input = window.metrion.helpers.get_cookie_value(configuration.user_cookie_name);
                        var user_expire = parseInt(user_input.split(configuration.cookie_separator)[1]);
                        return new Date(user_expire) < new Date();
                    },

                    get_user_id: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.user_manager.user_cookie_exists()) {
                            return undefined;
                        }

                        var user_cookie_value = window.metrion.helpers.get_cookie_value(configuration.user_cookie_name);
                        return user_cookie_value.split(configuration.cookie_separator)[0];
                    },

                    get_user_expiration_timestamp: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.user_manager.user_cookie_exists()) {
                            return undefined;
                        }

                        var user_cookie_value = window.metrion.helpers.get_cookie_value(configuration.user_cookie_name);
                        return parseInt(user_cookie_value.split(configuration.cookie_separator)[1]);
                    },

                    create_user_cookie: function () {
                        var configuration = window.metrion.configuration;

                        var user_id = window.metrion.helpers.generate_uuid();
                        var user_expire = new Date().setTime(new Date().getTime() + configuration.user_cookie_lifetime_milliseconds).toString();
                        var user_cookie_value = user_id + configuration.cookie_separator + user_expire;
                        window.metrion.helpers.set_cookie(configuration.user_cookie_name, user_cookie_value, configuration.user_cookie_lifetime_milliseconds, "/", window.metrion.helpers.get_cookie_domain(window.location.hostname));

                        return user_id;
                    },

                    extend_user_cookie_lifetime: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.user_manager.user_cookie_exists()) {
                            return undefined;
                        }

                        if (window.metrion.user_manager.is_user_cookie_expired()) {
                            return window.metrion.user_manager.create_user_cookie();
                        }

                        var user_id = window.metrion.user_manager.get_user_id();
                        var new_user_expire = new Date().setTime(new Date().getTime() + configuration.user_cookie_lifetime_milliseconds).toString();

                        var updated_user_cookie_value = user_id + configuration.cookie_separator + new_user_expire;
                        window.metrion.helpers.set_cookie(configuration.user_cookie_name, updated_user_cookie_value, configuration.user_cookie_lifetime_milliseconds, "/", window.metrion.helpers.get_cookie_domain(window.location.hostname));

                        return user_id;
                    }
                },

                session_manager: {
                    session_cookie_exists: function () {
                        var configuration = window.metrion.configuration;

                        return window.metrion.helpers.get_cookie_value(configuration.session_cookie_name) !== null;
                    },

                    is_session_cookie_expired: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.session_manager.session_cookie_exists()) {
                            return true;
                        }

                        var session_cookie_value = window.metrion.helpers.get_cookie_value(configuration.session_cookie_name);
                        var session_expiration = parseInt(session_cookie_value.split(configuration.cookie_separator)[1]);
                        return new Date(session_expiration) < new Date();
                    },

                    get_session_id: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.session_manager.session_cookie_exists()) {
                            return undefined;
                        }

                        var session_cookie_value = window.metrion.helpers.get_cookie_value(configuration.session_cookie_name);
                        return session_cookie_value.split(configuration.cookie_separator)[0];
                    },

                    get_session_expiration_timestamp: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.session_manager.session_cookie_exists()) {
                            return undefined;
                        }

                        var session_cookie_value = window.metrion.helpers.get_cookie_value(configuration.session_cookie_name);
                        return parseInt(session_cookie_value.split(configuration.cookie_separator)[1]);
                    },

                    create_session_cookie: function () {
                        var configuration = window.metrion.configuration;

                        var session_id = window.metrion.helpers.generate_uuid();
                        var session_expiration = new Date().setTime(new Date().getTime() + configuration.session_cookie_lifetime_milliseconds).toString();
                        var session_cookie_value = session_id + configuration.cookie_separator + session_expiration;
                        window.metrion.helpers.set_cookie(configuration.session_cookie_name, session_cookie_value, configuration.session_cookie_lifetime_milliseconds, "/", window.metrion.helpers.get_cookie_domain(window.location.hostname));

                        window.metrion.configuration.session_start_trigger = true;
                        window.metrion.configuration.session_start_reasons.push("new session id");

                        return session_id;
                    },

                    extend_session_cookie_lifetime: function () {
                        var configuration = window.metrion.configuration;

                        if (!window.metrion.session_manager.session_cookie_exists()) {
                            return undefined;
                        }

                        if (window.metrion.session_manager.is_session_cookie_expired()) {
                            return window.metrion.session_manager.create_session_cookie();
                        }

                        var session_id = window.metrion.session_manager.get_session_id();
                        var session_expiration = new Date().setTime(new Date().getTime() + configuration.session_cookie_lifetime_milliseconds).toString();

                        var updated_session_cookie_value = session_id + configuration.cookie_separator + session_expiration;
                        window.metrion.helpers.set_cookie(configuration.session_cookie_name, updated_session_cookie_value, configuration.session_cookie_lifetime_milliseconds, "/", window.metrion.helpers.get_cookie_domain(window.location.hostname));

                        return session_id;
                    }
                },

                helpers: {
                    generate_uuid_non_secure: function () {
                        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                        );
                    },

                    generate_uuid_secure: function () {
                        return crypto.randomUUID();
                    },

                    generate_uuid: function () {
                        try {
                            if (typeof (crypto.randomUUID) === "function") {
                                return window.metrion.helpers.generate_uuid_secure();
                            } else if (typeof (crypto.getRandomValues) === "function") {
                                return window.metrion.helpers.generate_uuid_non_secure();
                            }
                        } catch (e) {
                            return Math.floor(100000000 + Math.random() * 900000000).toString() + "." + new Date().getTime().toString();
                        }

                        return Math.floor(100000000 + Math.random() * 900000000).toString() + "." + new Date().getTime().toString();
                    },

                    get_cookie_value: function (cookie_name) {
                        var value = "; " + document.cookie;
                        var parts = value.split("; " + cookie_name + "=");

                        if (parts.length == 2) {
                            return parts.pop().split(";").shift();
                        }

                        return null;
                    },

                    set_cookie: function (cookie_name, cookie_value, cookie_lifetime_in_milliseconds, cookie_path, cookie_domain) {
                        var cookie_secure = ";secure";
                        var cookie_samesite = "lax";

                        var d = new Date();
                        d.setTime(d.getTime() + cookie_lifetime_in_milliseconds);
                        document.cookie = cookie_name + "=" + cookie_value + ";expires=" + d.toUTCString() + ";path=" + cookie_path + ";domain=" + cookie_domain + cookie_secure + ";samesite=" + cookie_samesite;
                    },
                    
                    get_cookie_domain: function(hostname) {
                        var publicSuffixes = ['co.uk', 'com.au', 'org.uk'];

                        var parts = hostname.split('.');

                        for (let i = 0; i < publicSuffixes.length; i++) {
                            var suffix = publicSuffixes[i];
                            if (hostname.endsWith(suffix)) {
                                var suffixParts = suffix.split('.').length;
                                return '.' + parts.slice(-1 - suffixParts).join('.');
                            }
                        }

                        return '.' + parts.slice(-2).join('.');
                    },

                    log_debug: function (message, type = 'log') {
                        if (metrion.configuration.debug_mode === '1') {
                            switch (type) {
                                case 'log':
                                    console.log(message);
                                    break;
                                case 'warn':
                                    console.warn(message);
                                    break;
                                case 'error':
                                    console.error(message);
                                    break;
                                default:
                                    console.log(message);
                            }
                        }
                    }
                },

                consent_manager: {
                    add_consent_update_listener: function (cmp_update_trigger, context) {
                        context.addEventListener(cmp_update_trigger, function () {
                            window.metrion.consent_manager.initial_consent_enforcement();
                            window.metrion.consent_manager.evaluate_consent_floodgate();
                        });
                    },

                    initial_consent_enforcement: function () {
                        var metrion_consent_cookie = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                        if (metrion_consent_cookie !== null) {
                            window.metrion.configuration.floodgate_open = true;
                        }

                        if (window.metrion.configuration.cmp_selection === "cookiebot") {
                            if (window.metrion.helpers.get_cookie_value("CookieConsent") !== null) {
                                window.metrion.configuration.floodgate_open = true;

                                var cookiebot_cookie = decodeURIComponent(window.metrion.helpers.get_cookie_value("CookieConsent"));
                                var encoded_cookie_value_based_on_cookiebot = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": Number(cookiebot_cookie.indexOf("marketing:true") > -1).toString(),
                                    "allow_pii": Number(cookiebot_cookie.indexOf("marketing:true") > -1).toString(),
                                    "allow_uid": Number(cookiebot_cookie.indexOf("necessary:true") > -1).toString(),
                                    "allow_sid": Number(cookiebot_cookie.indexOf("necessary:true") > -1).toString(),
                                    "unix": Date.now()
                                }));

                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_cookie_value_based_on_cookiebot,
                                    window.metrion.configuration.user_cookie_lifetime_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );

                                window.metrion.configuration.floodgate_open = true;
                            } else if (window.Cookiebot.consent) {
                                var encoded_cookie_value_based_on_cookiebot = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": Number(window.Cookiebot.consent.marketing).toString(),
                                    "allow_pii": Number(window.Cookiebot.consent.marketing).toString(),
                                    "allow_uid": Number(window.Cookiebot.consent.necessary).toString(),
                                    "allow_sid": Number(window.Cookiebot.consent.necessary).toString(),
                                    "unix": Date.now()
                                }));
                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_cookie_value_based_on_cookiebot,
                                    window.metrion.configuration.cookie_expiration_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );

                                window.metrion.configuration.floodgate_open = true;
                                window.metrion.consent_manager.evaluate_consent_floodgate();
                            }

                            window.metrion.consent_manager.add_consent_update_listener("CookiebotOnAccept", window);
                        }
                        else if (window.metrion.configuration.cmp_selection === "cookieyes") {
                            var cookieyes_value = window.metrion.helpers.get_cookie_value("cookieyes-consent");

                            if (cookieyes_value !== null && decodeURIComponent(cookieyes_value).indexOf("action:yes") > -1) {
                                window.metrion.configuration.floodgate_open = true;

                                var cookieyes_object = Object.fromEntries(
                                    decodeURIComponent(cookieyes_value)
                                        .split(',')
                                        .map(item => {
                                            var [key, value] = item.split(':');
                                            return [key, value === "yes" ? "1" : value === "no" ? "0" : value];
                                        })
                                );

                                var encoded_cookie_value_based_on_cookieyes = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": Number(cookieyes_object.advertisement).toString(),
                                    "allow_pii": Number(cookieyes_object.advertisement).toString(),
                                    "allow_uid": Number(cookieyes_object.necessary).toString(),
                                    "allow_sid": Number(cookieyes_object.necessary).toString(),
                                    "unix": Date.now()
                                }));
                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_cookie_value_based_on_cookieyes,
                                    window.metrion.configuration.user_cookie_lifetime_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );

                                window.metrion.configuration.floodgate_open = true;
                            }
                            window.metrion.consent_manager.add_consent_update_listener("cookieyes_consent_update", document);
                        }
                        else if (window.metrion.configuration.cmp_selection === "cmplz") {
                            var cmplz_banner_status = window.metrion.helpers.get_cookie_value("cmplz_banner-status");

                            if (cmplz_banner_status !== null && cmplz_banner_status === "dismissed") {
                                window.metrion.configuration.floodgate_open = true;

                                var encoded_cookie_value_based_on_cmplz = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": window.metrion.helpers.get_cookie_value("cmplz_marketing") === "allow" ? "1" : "0",
                                    "allow_pii": window.metrion.helpers.get_cookie_value("cmplz_marketing") === "allow" ? "1" : "0",
                                    "allow_uid": window.metrion.helpers.get_cookie_value("cmplz_functional") === "allow" ? "1" : "0",
                                    "allow_sid": window.metrion.helpers.get_cookie_value("cmplz_functional") === "allow" ? "1" : "0",
                                    "unix": Date.now()
                                }));
                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_cookie_value_based_on_cmplz,
                                    window.metrion.configuration.user_cookie_lifetime_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );

                                window.metrion.configuration.floodgate_open = true;
                            }
                            window.metrion.consent_manager.add_consent_update_listener("cmplz_status_change", document);
                        }

                        else if (window.metrion.configuration.cmp_selection === "onetrust") {
                            var onetrust_cookie = window.metrion.helpers.get_cookie_value("OptanonConsent");
                            if (onetrust_cookie !== null) {
                                var decoded_onetrust = decodeURIComponent(onetrust_cookie);
                                var groupsMatch = decoded_onetrust.match(/groups=([^;&]+)/);
                                if (groupsMatch) {
                                    var groups = groupsMatch[1].split(',');
                                    var allow_necessary = "0", allow_marketing = "0";
                                    groups.forEach(function (group) {
                                        var parts = group.split(':');
                                        if (parts[0] === "C0001") {
                                            allow_necessary = parts[1] === "1" ? "1" : "0";
                                        }
                                        if (parts[0] === "C0007" || parts[0] === "C0003") {
                                            allow_marketing = parts[1] === "1" ? "1" : "0";
                                        }
                                    });
                                    var encoded_value_based_on_onetrust = encodeURIComponent(JSON.stringify({
                                        "allow_marketing": allow_marketing,
                                        "allow_pii": allow_marketing,
                                        "allow_uid": allow_necessary,
                                        "allow_sid": allow_necessary,
                                        "unix": Date.now()
                                    }));
                                    window.metrion.helpers.set_cookie(
                                        window.metrion.configuration.consent_cookie_name,
                                        encoded_value_based_on_onetrust,
                                        window.metrion.configuration.cookie_expiration_milliseconds,
                                        "/",
                                        window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                    );
                                    window.metrion.configuration.floodgate_open = true;
                                }
                            }
                            window.metrion.consent_manager.add_consent_update_listener("OneTrustConsentUpdate", document);
                        }
                        else if (window.metrion.configuration.cmp_selection === "cookiefirst") {
                            var cookiefirst_cookie = window.metrion.helpers.get_cookie_value("CookieFirstConsent");
                            if (cookiefirst_cookie !== null) {
                                var parsed_cookiefirst;
                                try {
                                    parsed_cookiefirst = JSON.parse(decodeURIComponent(cookiefirst_cookie));
                                } catch (e) {
                                    parsed_cookiefirst = {};
                                }
                                var allow_marketing = (parsed_cookiefirst && parsed_cookiefirst.advertising) ? "1" : "0";
                                var allow_necessary = (parsed_cookiefirst && parsed_cookiefirst.necessary) ? "1" : "0";
                                var encoded_value_based_on_cookiefirst = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": allow_marketing,
                                    "allow_pii": allow_marketing,
                                    "allow_uid": allow_necessary,
                                    "allow_sid": allow_necessary,
                                    "unix": Date.now()
                                }));
                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_value_based_on_cookiefirst,
                                    window.metrion.configuration.cookie_expiration_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );
                                window.metrion.configuration.floodgate_open = true;
                            }
                            window.metrion.consent_manager.add_consent_update_listener("CookieFirstConsentUpdate", document);
                        }
                        else {
                            var metrion_consent_cookie = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                            var current_consent_object = {};
                            var reset_consent_based_on_config = true;
                            var manual_overwrite = "0";
                            if (metrion_consent_cookie !== null) {
                                current_consent_object = JSON.parse(decodeURIComponent(metrion_consent_cookie));

                                if (current_consent_object.allow_marketing != +window.metrion.configuration.consent_config.allow_marketing) {
                                    reset_consent_based_on_config = false;
                                    manual_overwrite = "1";
                                }
                                if (current_consent_object.allow_pii != +window.metrion.configuration.consent_config.allow_pii) {
                                    reset_consent_based_on_config = false;
                                    manual_overwrite = "1";
                                }
                                if (current_consent_object.allow_uid != +window.metrion.configuration.consent_config.allow_user_identification) {
                                    reset_consent_based_on_config = false;
                                    manual_overwrite = "1";
                                }
                                if (current_consent_object.allow_sid != +window.metrion.configuration.consent_config.allow_session_identification) {
                                    reset_consent_based_on_config = false;
                                    manual_overwrite = "1";
                                }
                            }

                            if (reset_consent_based_on_config === true) {
                                var encoded_backend_settings = encodeURIComponent(JSON.stringify({
                                    "allow_marketing": +window.metrion.configuration.consent_config.allow_marketing,
                                    "allow_pii": +window.metrion.configuration.consent_config.allow_pii,
                                    "allow_uid": +window.metrion.configuration.consent_config.allow_user_identification,
                                    "allow_sid": +window.metrion.configuration.consent_config.allow_session_identification,
                                    "unix": Date.now(),
                                    "m": manual_overwrite
                                }));

                                window.metrion.helpers.set_cookie(
                                    window.metrion.configuration.consent_cookie_name,
                                    encoded_backend_settings,
                                    window.metrion.configuration.user_cookie_lifetime_milliseconds,
                                    "/",
                                    window.metrion.helpers.get_cookie_domain(window.location.hostname)
                                );

                                window.metrion.configuration.floodgate_open = true;
                            }
                        }
                    },
                    evaluate_consent_floodgate: function () {
                        var floodgate_events = [];

                        if (window.metrion.configuration.floodgate_open === true && typeof localStorage !== "undefined") {
                            floodgate_events = JSON.parse(localStorage.getItem(window.metrion.configuration.floodgate_name)) || [];
                        }
                        else if (window.metrion.configuration.floodgate_open === true && typeof window.metrion.floodgate_events !== "undefined") {
                            floodgate_events = window.metrion.floodgate_events;
                        }

                        if (floodgate_events.length > 0) {
                            window.metrion.helpers.log_debug("Sending floodgated events", 'log');

                            for (let event of floodgate_events) {
                                window.metrion.send_floodgated_event(event);
                            }
                            localStorage.removeItem(window.metrion.configuration.floodgate_name);
                        }
                        else {
                            window.metrion.helpers.log_debug("No Floodgate events send", 'log');
                        }
                    },
                    update_consent: function (consent_object) {
                        var metrion_consent_cookie = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                        if (metrion_consent_cookie !== null) {
                            current_consent_object = JSON.parse(decodeURIComponent(metrion_consent_cookie));
                            updated_consent_object = consent_object;

                            for (var key in updated_consent_object) {
                                if (updated_consent_object.hasOwnProperty(key) && current_consent_object.hasOwnProperty(key)) {
                                    current_consent_object[key] = updated_consent_object[key].toString();
                                }
                            }
                            current_consent_object["unix"] = Date.now();
                            current_consent_object["m"] = "1";

                            window.metrion.helpers.set_cookie(
                                window.metrion.configuration.consent_cookie_name,
                                encodeURIComponent(JSON.stringify(current_consent_object)),
                                window.metrion.configuration.user_cookie_lifetime_milliseconds,
                                "/",
                                window.metrion.helpers.get_cookie_domain(window.location.hostname)
                            );
                        }
                    }
                },

                send_floodgated_event: function (stored_event) {
                    var current_stored_event = stored_event;
                    var consent_cookie_value = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                    var metrion_consent_cookie_value = JSON.parse(decodeURIComponent(consent_cookie_value));
                    var allow_uid = metrion_consent_cookie_value.allow_uid === "1";
                    var allow_sid = metrion_consent_cookie_value.allow_sid === "1";

                    if (allow_uid) {
                        current_stored_event[window.metrion.configuration.user_cookie_name] = window.metrion.helpers.get_cookie_value(window.metrion.configuration.user_cookie_name + '_js');
                    }

                    if (allow_sid) {
                        current_stored_event[window.metrion.configuration.session_cookie_name] = window.metrion.session_manager.get_session_id();
                    }

                    current_stored_event.consent = metrion_consent_cookie_value;
                    current_stored_event["screen_height"] = screen.height || "";
                    current_stored_event["screen_width"] = screen.width || "";
                    current_stored_event["user_agent"] = navigator.userAgent || "";
                    current_stored_event["language"] = navigator.language || "";
                    current_stored_event["consent"] = metrion_consent_cookie_value;
                    current_stored_event["context"]["floodgated"] = true;
                    current_stored_event["context"]["floodgate_release_unix_timestamp"] = Date.now();

                    window.metrion.helpers.log_debug("Sending event data to API...", 'log');
                    if (navigator.sendBeacon) {
                        var blob = new Blob([JSON.stringify(current_stored_event)], { type: 'application/json;charset=UTF-8' });
                        navigator.sendBeacon(window.metrion.configuration.event_endpoint, blob);
                    } else {
                        var xmlhttp = new XMLHttpRequest();
                        xmlhttp.open("POST", window.metrion.configuration.event_endpoint, true);
                        xmlhttp.setRequestHeader("Content-Type", "application/json");
                        xmlhttp.send(JSON.stringify(current_stored_event));
                    }

                    window.metrion.configuration.event_broker_queue.push({
                        "event_name": current_stored_event.event_name,
                        "event_data": current_stored_event
                    });
                },

                send_event: function (event_name, event_body) {
                    if (!window.metrion.user_manager.user_cookie_exists() || window.metrion.user_manager.is_user_cookie_expired()) {
                        window.metrion.user_manager.create_user_cookie();
                    }
                    if (!window.metrion.session_manager.session_cookie_exists() || window.metrion.session_manager.is_session_cookie_expired()) {
                        window.metrion.session_manager.create_session_cookie();
                    } else {
                        window.metrion.session_manager.extend_session_cookie_lifetime();
                    }

                    event_body["browser_support_safe_uuid"] = window.metrion.configuration.browser_support_safe_uuid;
                    var event_data = {
                        "metrion_event_id": window.metrion.helpers.generate_uuid(),
                        "event_name": event_name,
                        "event_timestamp": new Date().toISOString(),
                        "event_unix_timestamp": Date.now(),
                        "screen_height": screen.height || "",
                        "screen_width": screen.width || "",
                        "user_agent": navigator.userAgent || "",
                        "language": navigator.language || "",
                        "location": {
                            "protocol": window.location.protocol || "",
                            "host": window.location.host || "",
                            "path": window.location.pathname || "",
                            "query": window.location.search || "",
                            "hash": window.location.hash || "",
                            "referrer": document.referrer || "",
                        },
                        "context": event_body || {},
                        "store_id": window.metrion.configuration.metrion_retrieved_store_id
                    }
                    event_data["context"]["browser_support_safe_uuid"] = window.metrion.configuration.browser_support_safe_uuid;
                    event_data["context"]["init_unix_timestamp"] = window.metrion.configuration.init_unix_timestamp;

                    if (!window.metrion.session_manager.session_cookie_exists()) {
                        window.metrion.session_manager.create_session_cookie();
                    }
                    if (window.metrion.session_manager.is_session_cookie_expired()) {
                        window.metrion.session_manager.create_session_cookie();
                    } else {
                        window.metrion.session_manager.extend_session_cookie_lifetime();
                    }

                    window.metrion.helpers.log_debug(("Consent cookie value:  " + window.metrion.helpers.get_cookie_value(decodeURIComponent(window.metrion.configuration.consent_cookie_name))), 'log');
                    window.metrion.helpers.log_debug("User cookie value: " + window.metrion.helpers.get_cookie_value(window.metrion.configuration.user_cookie_name + '_js'), 'log');

                    if (window.metrion.configuration.floodgate_open === true) {
                        var consent_cookie_value = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                        var metrion_consent_cookie_value = JSON.parse(decodeURIComponent(consent_cookie_value));
                        var allow_uid = metrion_consent_cookie_value ? metrion_consent_cookie_value.allow_uid === "1" : false;
                        var allow_sid = metrion_consent_cookie_value ? metrion_consent_cookie_value.allow_sid === "1" : false;
                        if (allow_uid) {
                            event_data[window.metrion.configuration.user_cookie_name] = window.metrion.helpers.get_cookie_value(window.metrion.configuration.user_cookie_name + '_js');
                        }
                        if (allow_sid) {
                            event_data[window.metrion.configuration.session_cookie_name] = window.metrion.session_manager.get_session_id();
                        }

                        event_data["screen_height"] = screen.height || "";
                        event_data["screen_width"] = screen.width || "";
                        event_data["user_agent"] = navigator.userAgent || "";
                        event_data["language"] = navigator.language || "";
                        event_data["consent"] = metrion_consent_cookie_value;

                        window.metrion.helpers.log_debug("Sending event data to API...", 'log');
                        if (navigator.sendBeacon) {
                            var blob = new Blob([JSON.stringify(event_data)], { type: 'application/json;charset=UTF-8' });
                            navigator.sendBeacon(window.metrion.configuration.event_endpoint, blob);
                        } else {
                            var xmlhttp = new XMLHttpRequest();
                            xmlhttp.open("POST", window.metrion.configuration.event_endpoint, true);
                            xmlhttp.setRequestHeader("Content-Type", "application/json");
                            xmlhttp.send(JSON.stringify(event_data));
                        }

                        window.metrion.configuration.event_broker_queue.push({
                            "event_name": event_name,
                            "event_data": event_data
                        });
                    }
                    else {
                        if (typeof localStorage !== "undefined") {
                            floodgate_events = JSON.parse(localStorage.getItem(window.metrion.configuration.floodgate_name)) || [];
                            floodgate_events.push(event_data);
                            window.metrion.helpers.log_debug("Event floodgated using localStorage", 'log');
                            localStorage.setItem(window.metrion.configuration.floodgate_name, JSON.stringify(floodgate_events));
                        }
                        else {
                            floodgate_events = window.metrion.floodgate_events || [];
                            floodgate_events.push(event_data);
                            window.metrion.helpers.log_debug("Event floodgated using JS variable", 'log');
                        }
                    }
                }
            };

            (function () {
                window.metrion.consent_manager.initial_consent_enforcement();
                window.metrion.consent_manager.evaluate_consent_floodgate();
            })();

            (function () {
                if (performance.getEntriesByType("navigation")[0].type === "reload") {
                    return;
                }

                const payment_referrer_exclusions = [
                    "anbamro.nl",
                    "asnbank.nl",
                    "pay.mollie.nl",
                    "mollie.com",
                    "paypal.com",
                    "klarna.com",
                    "girogate.be",
                    "snsbank.nl",
                    "rabobank.nl",
                    "knab.nl",
                    "bunq.com",
                    ".ing.nl",
                    "regiobank.nl",
                    "triodos.nl",
                    "vanlanschot.nl",
                    "moneyou.nl",
                    "multisafepay.com",
                    "agone.com",
                    "pay.nl",
                    "sips-atos.com",
                    "curopayments.net",
                    "ideal.nl",
                    "adyen.com",
                    "afterpay.nl",
                    "tikkie.me",
                    "buckaroo.nl",
                    "sisow.nl",
                    "targetpay.com",
                    "paypro.nl",
                    "icepay.nl",
                    "omnikassa.rabobank.nl",
                    "postnl.nl",
                    "billink.nl",
                    "spraypay.nl",
                    "capayable.nl",
                    "in3.nl",
                    "klarna.nl",
                    "vividmoney.nl",
                    "revolut.com",
                    "n26.com",
                    "wise.com",
                    "bancontact.com",
                    "belfius.be",
                    "cbc.be",
                    "kbc.be",
                    ".ing.be",
                    "bnpparibasfortis.be",
                    "keytradebank.be",
                    "argenta.be",
                    "fintro.be",
                    "hellobank.be",
                    "crelan.be",
                    "axabank.be",
                    "recordbank.be",
                    "sofort.com",
                    "stripe.com",
                    "worldline.com",
                    "eps-payment.eu",
                    "ogone.com",
                    "viva.com",
                    "twikey.com",
                    "hipay.com",
                    "payconiq.com",
                    "postfinance.be",
                    "six-payment-services.com"
                ];
                var regex_payment = new RegExp(
                    payment_referrer_exclusions.map(domain => domain.replace(/\./g, '\\.')).join("|"), "i");
                if (regex_payment.test(document.referrer)) {
                    return;
                }

                if (document.referrer !== "") {
                    var referrerHost = new URL(document.referrer).hostname.split('.').slice(-2).join('.');
                    var currentHost = location.hostname.split('.').slice(-2).join('.');
                    if (referrerHost !== currentHost) {
                        window.metrion.configuration.session_start_trigger = true;
                        window.metrion.configuration.session_start_reasons.push("new referrer");
                    }
                }
                else {
                    window.metrion.configuration.session_start_trigger = true;
                    window.metrion.configuration.session_start_reasons.push("no referrer");
                }

                if (window.location.search.indexOf("utm_") > -1) {
                    window.metrion.configuration.session_start_trigger = true;
                    window.metrion.configuration.session_start_reasons.push("utms detected");
                }

                var known_advertising_params = [
                    "__hsfp",
                    "__hssc",
                    "__hstc",
                    "__s",
                    "_hsenc",
                    "_openstat",
                    "dclid",
                    "fbclid",
                    "gclid",
                    "hsCtaTracking",
                    "mc_eid",
                    "mkt_tok",
                    "ml_subscriber",
                    "ml_subscriber_hash",
                    "msclkid",
                    "oly_anon_id",
                    "oly_enc_id",
                    "rb_clickid",
                    "s_cid",
                    "vero_conv",
                    "vero_id",
                    "wickedid",
                    "yclid"
                ];
                var known_advertising_param_present = known_advertising_params.some(param => window.location.search.includes(param));
                if (known_advertising_param_present && window.location.search.indexOf("_gl") === -1) {
                    window.metrion.configuration.session_start_trigger = true;
                    window.metrion.configuration.session_start_reasons.push("advertising param detected");
                }

                var duplicate_session_start = false;
                if (window.metrion.configuration.session_start_trigger === true && sessionStorage) {
                    var current_session_info = JSON.stringify({
                        "reasons": window.metrion.configuration.session_start_reasons,
                        "referrer": document.referrer,
                        "search": window.location.search
                    });
                    var previous_session_info = sessionStorage.getItem(window.metrion.configuration.session_info_storage_name);

                    if (current_session_info === previous_session_info) {
                        duplicate_session_start = true;
                    }
                    else {
                        sessionStorage.setItem(window.metrion.configuration.session_info_storage_name, current_session_info);
                    }
                }

                if (window.metrion.configuration.session_start_trigger === true && duplicate_session_start === false) {
                    window.metrion.session_manager.create_session_cookie();
                    window.metrion.configuration.session_start_trigger = false;
                    window.metrion.send_event("session_start", { "reason": window.metrion.configuration.session_start_reasons.toString() }, {})
                }
            })();

            (function () {
                window.pixel_pageview_send = window.pixel_pageview_send || false;
                if (!window.pixel_pageview_send) {
                    window.metrion.send_event("page_view", {});
                    window.pixel_pageview_send = true;
                }
            })();

            if (typeof window.metrionOrderData !== 'undefined') {

                var data = window.metrionOrderData;
                data["store_id"] = config.store_id;

                fetch('/rest/V1/metrion/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify((data))
                });

                (function () {
                    var metrion_consent_cookie = window.metrion.helpers.get_cookie_value(window.metrion.configuration.consent_cookie_name);
                    var current_consent_object = {};
                    if (metrion_consent_cookie !== null) {
                        current_consent_object = JSON.parse(decodeURIComponent(metrion_consent_cookie));
                    }

                    if (current_consent_object.allow_marketing === 1 && current_consent_object.allow_pii === 1) {
                        if (window.metrion.configuration.base_config.enable_google_tracking) {
                            window.metrion_google_ads = {
                                init: function () {
                                    if (typeof window.gtag === "undefined") {
                                        window.dataLayer = window.dataLayer || [];

                                        function gtag() { window.dataLayer.push(arguments); }

                                        var gtag_script = document.createElement('script');
                                        gtag_script.async = true;
                                        gtag_script.src = 'https://www.googletagmanager.com/gtag/js?id=' + window.metrion.configuration.base_config.google_ads_purchase_enhanced_conversion_id;
                                        document.body.appendChild(gtag_script);

                                        gtag_script.onload = function () {
                                            gtag('js', new Date());
                                            gtag('config', window.metrion.configuration.base_config.google_ads_purchase_enhanced_conversion_id);
                                            window.gtag = gtag;
                                            window.metrion_google_ads.trigger_purchase();
                                        };
                                    } else {
                                        window.gtag('config', window.metrion.configuration.base_config.google_ads_purchase_enhanced_conversion_id);
                                        window.metrion_google_ads.trigger_purchase();
                                    }

                                },
                                trigger_purchase: function () {
                                    var conversion_id = window.metrion.configuration.base_config.google_ads_purchase_enhanced_conversion_id;
                                    var conversion_label = window.metrion.configuration.base_config.google_ads_purchase_enhanced_conversion_label;

                                    if (typeof window.metrionOrderData === 'undefined') {
                                        return;
                                    }
                                    var data = window.metrionOrderData;
                                    data["store_id"] = window.metrion.configuration.base_config["store_id"];

                                    window.gtag('event', 'conversion', {
                                        'send_to': (conversion_id + "/" + conversion_label),
                                        'value': data.context.order_total,
                                        'currency': data.context.currency_code,
                                        'transaction_id': data.context.order_id
                                    });

                                    window.metrion.send_event("gtag_conversion_enhanced", {
                                        'send_to': (conversion_id + "/" + conversion_label),
                                        'value': data.context.order_total,
                                        'currency': data.context.currency_code,
                                        'transaction_id': data.context.order_id
                                    }, {});
                                }
                            };
                            window.metrion_google_ads.init();
                        }
                    }
                })();
            }
        })
        .catch(error => console.error('Error fetching Metrion config:', error));
});