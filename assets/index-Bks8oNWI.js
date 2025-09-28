(async ()=>{
    (function() {
        const t = document.createElement("link").relList;
        if (t && t.supports && t.supports("modulepreload")) return;
        for (const l of document.querySelectorAll('link[rel="modulepreload"]'))r(l);
        new MutationObserver((l)=>{
            for (const i of l)if (i.type === "childList") for (const o of i.addedNodes)o.tagName === "LINK" && o.rel === "modulepreload" && r(o);
        }).observe(document, {
            childList: !0,
            subtree: !0
        });
        function n(l) {
            const i = {};
            return l.integrity && (i.integrity = l.integrity), l.referrerPolicy && (i.referrerPolicy = l.referrerPolicy), l.crossOrigin === "use-credentials" ? i.credentials = "include" : l.crossOrigin === "anonymous" ? i.credentials = "omit" : i.credentials = "same-origin", i;
        }
        function r(l) {
            if (l.ep) return;
            l.ep = !0;
            const i = n(l);
            fetch(l.href, i);
        }
    })();
    function Ac(e) {
        return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
    }
    var xs = {
        exports: {}
    }, Cl = {}, Es = {
        exports: {}
    }, M = {};
    var gr = Symbol.for("react.element"), Vc = Symbol.for("react.portal"), Uc = Symbol.for("react.fragment"), Wc = Symbol.for("react.strict_mode"), $c = Symbol.for("react.profiler"), Bc = Symbol.for("react.provider"), Hc = Symbol.for("react.context"), Qc = Symbol.for("react.forward_ref"), Gc = Symbol.for("react.suspense"), Kc = Symbol.for("react.memo"), Yc = Symbol.for("react.lazy"), iu = Symbol.iterator;
    function Xc(e) {
        return e === null || typeof e != "object" ? null : (e = iu && e[iu] || e["@@iterator"], typeof e == "function" ? e : null);
    }
    var _s = {
        isMounted: function() {
            return !1;
        },
        enqueueForceUpdate: function() {},
        enqueueReplaceState: function() {},
        enqueueSetState: function() {}
    }, Cs = Object.assign, Ns = {};
    function _n(e, t, n) {
        this.props = e, this.context = t, this.refs = Ns, this.updater = n || _s;
    }
    _n.prototype.isReactComponent = {};
    _n.prototype.setState = function(e, t) {
        if (typeof e != "object" && typeof e != "function" && e != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
        this.updater.enqueueSetState(this, e, t, "setState");
    };
    _n.prototype.forceUpdate = function(e) {
        this.updater.enqueueForceUpdate(this, e, "forceUpdate");
    };
    function Ts() {}
    Ts.prototype = _n.prototype;
    function co(e, t, n) {
        this.props = e, this.context = t, this.refs = Ns, this.updater = n || _s;
    }
    var fo = co.prototype = new Ts;
    fo.constructor = co;
    Cs(fo, _n.prototype);
    fo.isPureReactComponent = !0;
    var ou = Array.isArray, Ps = Object.prototype.hasOwnProperty, po = {
        current: null
    }, Rs = {
        key: !0,
        ref: !0,
        __self: !0,
        __source: !0
    };
    function Ls(e, t, n) {
        var r, l = {}, i = null, o = null;
        if (t != null) for(r in t.ref !== void 0 && (o = t.ref), t.key !== void 0 && (i = "" + t.key), t)Ps.call(t, r) && !Rs.hasOwnProperty(r) && (l[r] = t[r]);
        var u = arguments.length - 2;
        if (u === 1) l.children = n;
        else if (1 < u) {
            for(var s = Array(u), a = 0; a < u; a++)s[a] = arguments[a + 2];
            l.children = s;
        }
        if (e && e.defaultProps) for(r in u = e.defaultProps, u)l[r] === void 0 && (l[r] = u[r]);
        return {
            $$typeof: gr,
            type: e,
            key: i,
            ref: o,
            props: l,
            _owner: po.current
        };
    }
    function qc(e, t) {
        return {
            $$typeof: gr,
            type: e.type,
            key: t,
            ref: e.ref,
            props: e.props,
            _owner: e._owner
        };
    }
    function ho(e) {
        return typeof e == "object" && e !== null && e.$$typeof === gr;
    }
    function Zc(e) {
        var t = {
            "=": "=0",
            ":": "=2"
        };
        return "$" + e.replace(/[=:]/g, function(n) {
            return t[n];
        });
    }
    var uu = /\/+/g;
    function Wl(e, t) {
        return typeof e == "object" && e !== null && e.key != null ? Zc("" + e.key) : t.toString(36);
    }
    function $r(e, t, n, r, l) {
        var i = typeof e;
        (i === "undefined" || i === "boolean") && (e = null);
        var o = !1;
        if (e === null) o = !0;
        else switch(i){
            case "string":
            case "number":
                o = !0;
                break;
            case "object":
                switch(e.$$typeof){
                    case gr:
                    case Vc:
                        o = !0;
                }
        }
        if (o) return o = e, l = l(o), e = r === "" ? "." + Wl(o, 0) : r, ou(l) ? (n = "", e != null && (n = e.replace(uu, "$&/") + "/"), $r(l, t, n, "", function(a) {
            return a;
        })) : l != null && (ho(l) && (l = qc(l, n + (!l.key || o && o.key === l.key ? "" : ("" + l.key).replace(uu, "$&/") + "/") + e)), t.push(l)), 1;
        if (o = 0, r = r === "" ? "." : r + ":", ou(e)) for(var u = 0; u < e.length; u++){
            i = e[u];
            var s = r + Wl(i, u);
            o += $r(i, t, n, s, l);
        }
        else if (s = Xc(e), typeof s == "function") for(e = s.call(e), u = 0; !(i = e.next()).done;)i = i.value, s = r + Wl(i, u++), o += $r(i, t, n, s, l);
        else if (i === "object") throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
        return o;
    }
    function Er(e, t, n) {
        if (e == null) return e;
        var r = [], l = 0;
        return $r(e, r, "", "", function(i) {
            return t.call(n, i, l++);
        }), r;
    }
    function Jc(e) {
        if (e._status === -1) {
            var t = e._result;
            t = t(), t.then(function(n) {
                (e._status === 0 || e._status === -1) && (e._status = 1, e._result = n);
            }, function(n) {
                (e._status === 0 || e._status === -1) && (e._status = 2, e._result = n);
            }), e._status === -1 && (e._status = 0, e._result = t);
        }
        if (e._status === 1) return e._result.default;
        throw e._result;
    }
    var ve = {
        current: null
    }, Br = {
        transition: null
    }, bc = {
        ReactCurrentDispatcher: ve,
        ReactCurrentBatchConfig: Br,
        ReactCurrentOwner: po
    };
    function Fs() {
        throw Error("act(...) is not supported in production builds of React.");
    }
    M.Children = {
        map: Er,
        forEach: function(e, t, n) {
            Er(e, function() {
                t.apply(this, arguments);
            }, n);
        },
        count: function(e) {
            var t = 0;
            return Er(e, function() {
                t++;
            }), t;
        },
        toArray: function(e) {
            return Er(e, function(t) {
                return t;
            }) || [];
        },
        only: function(e) {
            if (!ho(e)) throw Error("React.Children.only expected to receive a single React element child.");
            return e;
        }
    };
    M.Component = _n;
    M.Fragment = Uc;
    M.Profiler = $c;
    M.PureComponent = co;
    M.StrictMode = Wc;
    M.Suspense = Gc;
    M.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = bc;
    M.act = Fs;
    M.cloneElement = function(e, t, n) {
        if (e == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + e + ".");
        var r = Cs({}, e.props), l = e.key, i = e.ref, o = e._owner;
        if (t != null) {
            if (t.ref !== void 0 && (i = t.ref, o = po.current), t.key !== void 0 && (l = "" + t.key), e.type && e.type.defaultProps) var u = e.type.defaultProps;
            for(s in t)Ps.call(t, s) && !Rs.hasOwnProperty(s) && (r[s] = t[s] === void 0 && u !== void 0 ? u[s] : t[s]);
        }
        var s = arguments.length - 2;
        if (s === 1) r.children = n;
        else if (1 < s) {
            u = Array(s);
            for(var a = 0; a < s; a++)u[a] = arguments[a + 2];
            r.children = u;
        }
        return {
            $$typeof: gr,
            type: e.type,
            key: l,
            ref: i,
            props: r,
            _owner: o
        };
    };
    M.createContext = function(e) {
        return e = {
            $$typeof: Hc,
            _currentValue: e,
            _currentValue2: e,
            _threadCount: 0,
            Provider: null,
            Consumer: null,
            _defaultValue: null,
            _globalName: null
        }, e.Provider = {
            $$typeof: Bc,
            _context: e
        }, e.Consumer = e;
    };
    M.createElement = Ls;
    M.createFactory = function(e) {
        var t = Ls.bind(null, e);
        return t.type = e, t;
    };
    M.createRef = function() {
        return {
            current: null
        };
    };
    M.forwardRef = function(e) {
        return {
            $$typeof: Qc,
            render: e
        };
    };
    M.isValidElement = ho;
    M.lazy = function(e) {
        return {
            $$typeof: Yc,
            _payload: {
                _status: -1,
                _result: e
            },
            _init: Jc
        };
    };
    M.memo = function(e, t) {
        return {
            $$typeof: Kc,
            type: e,
            compare: t === void 0 ? null : t
        };
    };
    M.startTransition = function(e) {
        var t = Br.transition;
        Br.transition = {};
        try {
            e();
        } finally{
            Br.transition = t;
        }
    };
    M.unstable_act = Fs;
    M.useCallback = function(e, t) {
        return ve.current.useCallback(e, t);
    };
    M.useContext = function(e) {
        return ve.current.useContext(e);
    };
    M.useDebugValue = function() {};
    M.useDeferredValue = function(e) {
        return ve.current.useDeferredValue(e);
    };
    M.useEffect = function(e, t) {
        return ve.current.useEffect(e, t);
    };
    M.useId = function() {
        return ve.current.useId();
    };
    M.useImperativeHandle = function(e, t, n) {
        return ve.current.useImperativeHandle(e, t, n);
    };
    M.useInsertionEffect = function(e, t) {
        return ve.current.useInsertionEffect(e, t);
    };
    M.useLayoutEffect = function(e, t) {
        return ve.current.useLayoutEffect(e, t);
    };
    M.useMemo = function(e, t) {
        return ve.current.useMemo(e, t);
    };
    M.useReducer = function(e, t, n) {
        return ve.current.useReducer(e, t, n);
    };
    M.useRef = function(e) {
        return ve.current.useRef(e);
    };
    M.useState = function(e) {
        return ve.current.useState(e);
    };
    M.useSyncExternalStore = function(e, t, n) {
        return ve.current.useSyncExternalStore(e, t, n);
    };
    M.useTransition = function() {
        return ve.current.useTransition();
    };
    M.version = "18.3.1";
    Es.exports = M;
    var F = Es.exports;
    const ef = Ac(F);
    var tf = F, nf = Symbol.for("react.element"), rf = Symbol.for("react.fragment"), lf = Object.prototype.hasOwnProperty, of = tf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, uf = {
        key: !0,
        ref: !0,
        __self: !0,
        __source: !0
    };
    function js(e, t, n) {
        var r, l = {}, i = null, o = null;
        n !== void 0 && (i = "" + n), t.key !== void 0 && (i = "" + t.key), t.ref !== void 0 && (o = t.ref);
        for(r in t)lf.call(t, r) && !uf.hasOwnProperty(r) && (l[r] = t[r]);
        if (e && e.defaultProps) for(r in t = e.defaultProps, t)l[r] === void 0 && (l[r] = t[r]);
        return {
            $$typeof: nf,
            type: e,
            key: i,
            ref: o,
            props: l,
            _owner: of.current
        };
    }
    Cl.Fragment = rf;
    Cl.jsx = js;
    Cl.jsxs = js;
    xs.exports = Cl;
    var y = xs.exports, vi = {}, zs = {
        exports: {}
    }, Pe = {}, Is = {
        exports: {}
    }, Ms = {};
    (function(e) {
        function t(C, h) {
            var x = C.length;
            C.push(h);
            e: for(; 0 < x;){
                var L = x - 1 >>> 1, j = C[L];
                if (0 < l(j, h)) C[L] = h, C[x] = j, x = L;
                else break e;
            }
        }
        function n(C) {
            return C.length === 0 ? null : C[0];
        }
        function r(C) {
            if (C.length === 0) return null;
            var h = C[0], x = C.pop();
            if (x !== h) {
                C[0] = x;
                e: for(var L = 0, j = C.length, B = j >>> 1; L < B;){
                    var ne = 2 * (L + 1) - 1, ct = C[ne], Le = ne + 1, I = C[Le];
                    if (0 > l(ct, x)) Le < j && 0 > l(I, ct) ? (C[L] = I, C[Le] = x, L = Le) : (C[L] = ct, C[ne] = x, L = ne);
                    else if (Le < j && 0 > l(I, x)) C[L] = I, C[Le] = x, L = Le;
                    else break e;
                }
            }
            return h;
        }
        function l(C, h) {
            var x = C.sortIndex - h.sortIndex;
            return x !== 0 ? x : C.id - h.id;
        }
        if (typeof performance == "object" && typeof performance.now == "function") {
            var i = performance;
            e.unstable_now = function() {
                return i.now();
            };
        } else {
            var o = Date, u = o.now();
            e.unstable_now = function() {
                return o.now() - u;
            };
        }
        var s = [], a = [], v = 1, m = null, p = 3, g = !1, k = !1, E = !1, O = typeof setTimeout == "function" ? setTimeout : null, f = typeof clearTimeout == "function" ? clearTimeout : null, c = typeof setImmediate < "u" ? setImmediate : null;
        typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
        function d(C) {
            for(var h = n(a); h !== null;){
                if (h.callback === null) r(a);
                else if (h.startTime <= C) r(a), h.sortIndex = h.expirationTime, t(s, h);
                else break;
                h = n(a);
            }
        }
        function w(C) {
            if (E = !1, d(C), !k) if (n(s) !== null) k = !0, Ft(_);
            else {
                var h = n(a);
                h !== null && Xt(w, h.startTime - C);
            }
        }
        function _(C, h) {
            k = !1, E && (E = !1, f(R), R = -1), g = !0;
            var x = p;
            try {
                for(d(h), m = n(s); m !== null && (!(m.expirationTime > h) || C && !b());){
                    var L = m.callback;
                    if (typeof L == "function") {
                        m.callback = null, p = m.priorityLevel;
                        var j = L(m.expirationTime <= h);
                        h = e.unstable_now(), typeof j == "function" ? m.callback = j : m === n(s) && r(s), d(h);
                    } else r(s);
                    m = n(s);
                }
                if (m !== null) var B = !0;
                else {
                    var ne = n(a);
                    ne !== null && Xt(w, ne.startTime - h), B = !1;
                }
                return B;
            } finally{
                m = null, p = x, g = !1;
            }
        }
        var T = !1, P = null, R = -1, $ = 5, z = -1;
        function b() {
            return !(e.unstable_now() - z < $);
        }
        function at() {
            if (P !== null) {
                var C = e.unstable_now();
                z = C;
                var h = !0;
                try {
                    h = P(!0, C);
                } finally{
                    h ? qe() : (T = !1, P = null);
                }
            } else T = !1;
        }
        var qe;
        if (typeof c == "function") qe = function() {
            c(at);
        };
        else if (typeof MessageChannel < "u") {
            var Tn = new MessageChannel, Pn = Tn.port2;
            Tn.port1.onmessage = at, qe = function() {
                Pn.postMessage(null);
            };
        } else qe = function() {
            O(at, 0);
        };
        function Ft(C) {
            P = C, T || (T = !0, qe());
        }
        function Xt(C, h) {
            R = O(function() {
                C(e.unstable_now());
            }, h);
        }
        e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(C) {
            C.callback = null;
        }, e.unstable_continueExecution = function() {
            k || g || (k = !0, Ft(_));
        }, e.unstable_forceFrameRate = function(C) {
            0 > C || 125 < C ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : $ = 0 < C ? Math.floor(1e3 / C) : 5;
        }, e.unstable_getCurrentPriorityLevel = function() {
            return p;
        }, e.unstable_getFirstCallbackNode = function() {
            return n(s);
        }, e.unstable_next = function(C) {
            switch(p){
                case 1:
                case 2:
                case 3:
                    var h = 3;
                    break;
                default:
                    h = p;
            }
            var x = p;
            p = h;
            try {
                return C();
            } finally{
                p = x;
            }
        }, e.unstable_pauseExecution = function() {}, e.unstable_requestPaint = function() {}, e.unstable_runWithPriority = function(C, h) {
            switch(C){
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    break;
                default:
                    C = 3;
            }
            var x = p;
            p = C;
            try {
                return h();
            } finally{
                p = x;
            }
        }, e.unstable_scheduleCallback = function(C, h, x) {
            var L = e.unstable_now();
            switch(typeof x == "object" && x !== null ? (x = x.delay, x = typeof x == "number" && 0 < x ? L + x : L) : x = L, C){
                case 1:
                    var j = -1;
                    break;
                case 2:
                    j = 250;
                    break;
                case 5:
                    j = 1073741823;
                    break;
                case 4:
                    j = 1e4;
                    break;
                default:
                    j = 5e3;
            }
            return j = x + j, C = {
                id: v++,
                callback: h,
                priorityLevel: C,
                startTime: x,
                expirationTime: j,
                sortIndex: -1
            }, x > L ? (C.sortIndex = x, t(a, C), n(s) === null && C === n(a) && (E ? (f(R), R = -1) : E = !0, Xt(w, x - L))) : (C.sortIndex = j, t(s, C), k || g || (k = !0, Ft(_))), C;
        }, e.unstable_shouldYield = b, e.unstable_wrapCallback = function(C) {
            var h = p;
            return function() {
                var x = p;
                p = h;
                try {
                    return C.apply(this, arguments);
                } finally{
                    p = x;
                }
            };
        };
    })(Ms);
    Is.exports = Ms;
    var sf = Is.exports;
    var af = F, Te = sf;
    function S(e) {
        for(var t = "https://reactjs.org/docs/error-decoder.html?invariant=" + e, n = 1; n < arguments.length; n++)t += "&args[]=" + encodeURIComponent(arguments[n]);
        return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    var Os = new Set, er = {};
    function Kt(e, t) {
        yn(e, t), yn(e + "Capture", t);
    }
    function yn(e, t) {
        for(er[e] = t, e = 0; e < t.length; e++)Os.add(t[e]);
    }
    var lt = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), yi = Object.prototype.hasOwnProperty, cf = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, su = {}, au = {};
    function ff(e) {
        return yi.call(au, e) ? !0 : yi.call(su, e) ? !1 : cf.test(e) ? au[e] = !0 : (su[e] = !0, !1);
    }
    function df(e, t, n, r) {
        if (n !== null && n.type === 0) return !1;
        switch(typeof t){
            case "function":
            case "symbol":
                return !0;
            case "boolean":
                return r ? !1 : n !== null ? !n.acceptsBooleans : (e = e.toLowerCase().slice(0, 5), e !== "data-" && e !== "aria-");
            default:
                return !1;
        }
    }
    function pf(e, t, n, r) {
        if (t === null || typeof t > "u" || df(e, t, n, r)) return !0;
        if (r) return !1;
        if (n !== null) switch(n.type){
            case 3:
                return !t;
            case 4:
                return t === !1;
            case 5:
                return isNaN(t);
            case 6:
                return isNaN(t) || 1 > t;
        }
        return !1;
    }
    function ye(e, t, n, r, l, i, o) {
        this.acceptsBooleans = t === 2 || t === 3 || t === 4, this.attributeName = r, this.attributeNamespace = l, this.mustUseProperty = n, this.propertyName = e, this.type = t, this.sanitizeURL = i, this.removeEmptyString = o;
    }
    var se = {};
    "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e) {
        se[e] = new ye(e, 0, !1, e, null, !1, !1);
    });
    [
        [
            "acceptCharset",
            "accept-charset"
        ],
        [
            "className",
            "class"
        ],
        [
            "htmlFor",
            "for"
        ],
        [
            "httpEquiv",
            "http-equiv"
        ]
    ].forEach(function(e) {
        var t = e[0];
        se[t] = new ye(t, 1, !1, e[1], null, !1, !1);
    });
    [
        "contentEditable",
        "draggable",
        "spellCheck",
        "value"
    ].forEach(function(e) {
        se[e] = new ye(e, 2, !1, e.toLowerCase(), null, !1, !1);
    });
    [
        "autoReverse",
        "externalResourcesRequired",
        "focusable",
        "preserveAlpha"
    ].forEach(function(e) {
        se[e] = new ye(e, 2, !1, e, null, !1, !1);
    });
    "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e) {
        se[e] = new ye(e, 3, !1, e.toLowerCase(), null, !1, !1);
    });
    [
        "checked",
        "multiple",
        "muted",
        "selected"
    ].forEach(function(e) {
        se[e] = new ye(e, 3, !0, e, null, !1, !1);
    });
    [
        "capture",
        "download"
    ].forEach(function(e) {
        se[e] = new ye(e, 4, !1, e, null, !1, !1);
    });
    [
        "cols",
        "rows",
        "size",
        "span"
    ].forEach(function(e) {
        se[e] = new ye(e, 6, !1, e, null, !1, !1);
    });
    [
        "rowSpan",
        "start"
    ].forEach(function(e) {
        se[e] = new ye(e, 5, !1, e.toLowerCase(), null, !1, !1);
    });
    var mo = /[\-:]([a-z])/g;
    function vo(e) {
        return e[1].toUpperCase();
    }
    "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e) {
        var t = e.replace(mo, vo);
        se[t] = new ye(t, 1, !1, e, null, !1, !1);
    });
    "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e) {
        var t = e.replace(mo, vo);
        se[t] = new ye(t, 1, !1, e, "http://www.w3.org/1999/xlink", !1, !1);
    });
    [
        "xml:base",
        "xml:lang",
        "xml:space"
    ].forEach(function(e) {
        var t = e.replace(mo, vo);
        se[t] = new ye(t, 1, !1, e, "http://www.w3.org/XML/1998/namespace", !1, !1);
    });
    [
        "tabIndex",
        "crossOrigin"
    ].forEach(function(e) {
        se[e] = new ye(e, 1, !1, e.toLowerCase(), null, !1, !1);
    });
    se.xlinkHref = new ye("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
    [
        "src",
        "href",
        "action",
        "formAction"
    ].forEach(function(e) {
        se[e] = new ye(e, 1, !1, e.toLowerCase(), null, !0, !0);
    });
    function yo(e, t, n, r) {
        var l = se.hasOwnProperty(t) ? se[t] : null;
        (l !== null ? l.type !== 0 : r || !(2 < t.length) || t[0] !== "o" && t[0] !== "O" || t[1] !== "n" && t[1] !== "N") && (pf(t, n, l, r) && (n = null), r || l === null ? ff(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, "" + n)) : l.mustUseProperty ? e[l.propertyName] = n === null ? l.type === 3 ? !1 : "" : n : (t = l.attributeName, r = l.attributeNamespace, n === null ? e.removeAttribute(t) : (l = l.type, n = l === 3 || l === 4 && n === !0 ? "" : "" + n, r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
    }
    var st = af.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, _r = Symbol.for("react.element"), Jt = Symbol.for("react.portal"), bt = Symbol.for("react.fragment"), go = Symbol.for("react.strict_mode"), gi = Symbol.for("react.profiler"), Ds = Symbol.for("react.provider"), As = Symbol.for("react.context"), wo = Symbol.for("react.forward_ref"), wi = Symbol.for("react.suspense"), Si = Symbol.for("react.suspense_list"), So = Symbol.for("react.memo"), dt = Symbol.for("react.lazy"), Vs = Symbol.for("react.offscreen"), cu = Symbol.iterator;
    function Ln(e) {
        return e === null || typeof e != "object" ? null : (e = cu && e[cu] || e["@@iterator"], typeof e == "function" ? e : null);
    }
    var K = Object.assign, $l;
    function An(e) {
        if ($l === void 0) try {
            throw Error();
        } catch (n) {
            var t = n.stack.trim().match(/\n( *(at )?)/);
            $l = t && t[1] || "";
        }
        return `
` + $l + e;
    }
    var Bl = !1;
    function Hl(e, t) {
        if (!e || Bl) return "";
        Bl = !0;
        var n = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
            if (t) if (t = function() {
                throw Error();
            }, Object.defineProperty(t.prototype, "props", {
                set: function() {
                    throw Error();
                }
            }), typeof Reflect == "object" && Reflect.construct) {
                try {
                    Reflect.construct(t, []);
                } catch (a) {
                    var r = a;
                }
                Reflect.construct(e, [], t);
            } else {
                try {
                    t.call();
                } catch (a) {
                    r = a;
                }
                e.call(t.prototype);
            }
            else {
                try {
                    throw Error();
                } catch (a) {
                    r = a;
                }
                e();
            }
        } catch (a) {
            if (a && r && typeof a.stack == "string") {
                for(var l = a.stack.split(`
`), i = r.stack.split(`
`), o = l.length - 1, u = i.length - 1; 1 <= o && 0 <= u && l[o] !== i[u];)u--;
                for(; 1 <= o && 0 <= u; o--, u--)if (l[o] !== i[u]) {
                    if (o !== 1 || u !== 1) do if (o--, u--, 0 > u || l[o] !== i[u]) {
                        var s = `
` + l[o].replace(" at new ", " at ");
                        return e.displayName && s.includes("<anonymous>") && (s = s.replace("<anonymous>", e.displayName)), s;
                    }
                    while (1 <= o && 0 <= u);
                    break;
                }
            }
        } finally{
            Bl = !1, Error.prepareStackTrace = n;
        }
        return (e = e ? e.displayName || e.name : "") ? An(e) : "";
    }
    function hf(e) {
        switch(e.tag){
            case 5:
                return An(e.type);
            case 16:
                return An("Lazy");
            case 13:
                return An("Suspense");
            case 19:
                return An("SuspenseList");
            case 0:
            case 2:
            case 15:
                return e = Hl(e.type, !1), e;
            case 11:
                return e = Hl(e.type.render, !1), e;
            case 1:
                return e = Hl(e.type, !0), e;
            default:
                return "";
        }
    }
    function ki(e) {
        if (e == null) return null;
        if (typeof e == "function") return e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch(e){
            case bt:
                return "Fragment";
            case Jt:
                return "Portal";
            case gi:
                return "Profiler";
            case go:
                return "StrictMode";
            case wi:
                return "Suspense";
            case Si:
                return "SuspenseList";
        }
        if (typeof e == "object") switch(e.$$typeof){
            case As:
                return (e.displayName || "Context") + ".Consumer";
            case Ds:
                return (e._context.displayName || "Context") + ".Provider";
            case wo:
                var t = e.render;
                return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case So:
                return t = e.displayName || null, t !== null ? t : ki(e.type) || "Memo";
            case dt:
                t = e._payload, e = e._init;
                try {
                    return ki(e(t));
                } catch  {}
        }
        return null;
    }
    function mf(e) {
        var t = e.type;
        switch(e.tag){
            case 24:
                return "Cache";
            case 9:
                return (t.displayName || "Context") + ".Consumer";
            case 10:
                return (t._context.displayName || "Context") + ".Provider";
            case 18:
                return "DehydratedFragment";
            case 11:
                return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
            case 7:
                return "Fragment";
            case 5:
                return t;
            case 4:
                return "Portal";
            case 3:
                return "Root";
            case 6:
                return "Text";
            case 16:
                return ki(t);
            case 8:
                return t === go ? "StrictMode" : "Mode";
            case 22:
                return "Offscreen";
            case 12:
                return "Profiler";
            case 21:
                return "Scope";
            case 13:
                return "Suspense";
            case 19:
                return "SuspenseList";
            case 25:
                return "TracingMarker";
            case 1:
            case 0:
            case 17:
            case 2:
            case 14:
            case 15:
                if (typeof t == "function") return t.displayName || t.name || null;
                if (typeof t == "string") return t;
        }
        return null;
    }
    function Nt(e) {
        switch(typeof e){
            case "boolean":
            case "number":
            case "string":
            case "undefined":
                return e;
            case "object":
                return e;
            default:
                return "";
        }
    }
    function Us(e) {
        var t = e.type;
        return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
    }
    function vf(e) {
        var t = Us(e) ? "checked" : "value", n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), r = "" + e[t];
        if (!e.hasOwnProperty(t) && typeof n < "u" && typeof n.get == "function" && typeof n.set == "function") {
            var l = n.get, i = n.set;
            return Object.defineProperty(e, t, {
                configurable: !0,
                get: function() {
                    return l.call(this);
                },
                set: function(o) {
                    r = "" + o, i.call(this, o);
                }
            }), Object.defineProperty(e, t, {
                enumerable: n.enumerable
            }), {
                getValue: function() {
                    return r;
                },
                setValue: function(o) {
                    r = "" + o;
                },
                stopTracking: function() {
                    e._valueTracker = null, delete e[t];
                }
            };
        }
    }
    function Cr(e) {
        e._valueTracker || (e._valueTracker = vf(e));
    }
    function Ws(e) {
        if (!e) return !1;
        var t = e._valueTracker;
        if (!t) return !0;
        var n = t.getValue(), r = "";
        return e && (r = Us(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n ? (t.setValue(e), !0) : !1;
    }
    function tl(e) {
        if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
        try {
            return e.activeElement || e.body;
        } catch  {
            return e.body;
        }
    }
    function xi(e, t) {
        var n = t.checked;
        return K({}, t, {
            defaultChecked: void 0,
            defaultValue: void 0,
            value: void 0,
            checked: n ?? e._wrapperState.initialChecked
        });
    }
    function fu(e, t) {
        var n = t.defaultValue == null ? "" : t.defaultValue, r = t.checked != null ? t.checked : t.defaultChecked;
        n = Nt(t.value != null ? t.value : n), e._wrapperState = {
            initialChecked: r,
            initialValue: n,
            controlled: t.type === "checkbox" || t.type === "radio" ? t.checked != null : t.value != null
        };
    }
    function $s(e, t) {
        t = t.checked, t != null && yo(e, "checked", t, !1);
    }
    function Ei(e, t) {
        $s(e, t);
        var n = Nt(t.value), r = t.type;
        if (n != null) r === "number" ? (n === 0 && e.value === "" || e.value != n) && (e.value = "" + n) : e.value !== "" + n && (e.value = "" + n);
        else if (r === "submit" || r === "reset") {
            e.removeAttribute("value");
            return;
        }
        t.hasOwnProperty("value") ? _i(e, t.type, n) : t.hasOwnProperty("defaultValue") && _i(e, t.type, Nt(t.defaultValue)), t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked);
    }
    function du(e, t, n) {
        if (t.hasOwnProperty("value") || t.hasOwnProperty("defaultValue")) {
            var r = t.type;
            if (!(r !== "submit" && r !== "reset" || t.value !== void 0 && t.value !== null)) return;
            t = "" + e._wrapperState.initialValue, n || t === e.value || (e.value = t), e.defaultValue = t;
        }
        n = e.name, n !== "" && (e.name = ""), e.defaultChecked = !!e._wrapperState.initialChecked, n !== "" && (e.name = n);
    }
    function _i(e, t, n) {
        (t !== "number" || tl(e.ownerDocument) !== e) && (n == null ? e.defaultValue = "" + e._wrapperState.initialValue : e.defaultValue !== "" + n && (e.defaultValue = "" + n));
    }
    var Vn = Array.isArray;
    function fn(e, t, n, r) {
        if (e = e.options, t) {
            t = {};
            for(var l = 0; l < n.length; l++)t["$" + n[l]] = !0;
            for(n = 0; n < e.length; n++)l = t.hasOwnProperty("$" + e[n].value), e[n].selected !== l && (e[n].selected = l), l && r && (e[n].defaultSelected = !0);
        } else {
            for(n = "" + Nt(n), t = null, l = 0; l < e.length; l++){
                if (e[l].value === n) {
                    e[l].selected = !0, r && (e[l].defaultSelected = !0);
                    return;
                }
                t !== null || e[l].disabled || (t = e[l]);
            }
            t !== null && (t.selected = !0);
        }
    }
    function Ci(e, t) {
        if (t.dangerouslySetInnerHTML != null) throw Error(S(91));
        return K({}, t, {
            value: void 0,
            defaultValue: void 0,
            children: "" + e._wrapperState.initialValue
        });
    }
    function pu(e, t) {
        var n = t.value;
        if (n == null) {
            if (n = t.children, t = t.defaultValue, n != null) {
                if (t != null) throw Error(S(92));
                if (Vn(n)) {
                    if (1 < n.length) throw Error(S(93));
                    n = n[0];
                }
                t = n;
            }
            t == null && (t = ""), n = t;
        }
        e._wrapperState = {
            initialValue: Nt(n)
        };
    }
    function Bs(e, t) {
        var n = Nt(t.value), r = Nt(t.defaultValue);
        n != null && (n = "" + n, n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)), r != null && (e.defaultValue = "" + r);
    }
    function hu(e) {
        var t = e.textContent;
        t === e._wrapperState.initialValue && t !== "" && t !== null && (e.value = t);
    }
    function Hs(e) {
        switch(e){
            case "svg":
                return "http://www.w3.org/2000/svg";
            case "math":
                return "http://www.w3.org/1998/Math/MathML";
            default:
                return "http://www.w3.org/1999/xhtml";
        }
    }
    function Ni(e, t) {
        return e == null || e === "http://www.w3.org/1999/xhtml" ? Hs(t) : e === "http://www.w3.org/2000/svg" && t === "foreignObject" ? "http://www.w3.org/1999/xhtml" : e;
    }
    var Nr, Qs = function(e) {
        return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(t, n, r, l) {
            MSApp.execUnsafeLocalFunction(function() {
                return e(t, n, r, l);
            });
        } : e;
    }(function(e, t) {
        if (e.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in e) e.innerHTML = t;
        else {
            for(Nr = Nr || document.createElement("div"), Nr.innerHTML = "<svg>" + t.valueOf().toString() + "</svg>", t = Nr.firstChild; e.firstChild;)e.removeChild(e.firstChild);
            for(; t.firstChild;)e.appendChild(t.firstChild);
        }
    });
    function tr(e, t) {
        if (t) {
            var n = e.firstChild;
            if (n && n === e.lastChild && n.nodeType === 3) {
                n.nodeValue = t;
                return;
            }
        }
        e.textContent = t;
    }
    var Hn = {
        animationIterationCount: !0,
        aspectRatio: !0,
        borderImageOutset: !0,
        borderImageSlice: !0,
        borderImageWidth: !0,
        boxFlex: !0,
        boxFlexGroup: !0,
        boxOrdinalGroup: !0,
        columnCount: !0,
        columns: !0,
        flex: !0,
        flexGrow: !0,
        flexPositive: !0,
        flexShrink: !0,
        flexNegative: !0,
        flexOrder: !0,
        gridArea: !0,
        gridRow: !0,
        gridRowEnd: !0,
        gridRowSpan: !0,
        gridRowStart: !0,
        gridColumn: !0,
        gridColumnEnd: !0,
        gridColumnSpan: !0,
        gridColumnStart: !0,
        fontWeight: !0,
        lineClamp: !0,
        lineHeight: !0,
        opacity: !0,
        order: !0,
        orphans: !0,
        tabSize: !0,
        widows: !0,
        zIndex: !0,
        zoom: !0,
        fillOpacity: !0,
        floodOpacity: !0,
        stopOpacity: !0,
        strokeDasharray: !0,
        strokeDashoffset: !0,
        strokeMiterlimit: !0,
        strokeOpacity: !0,
        strokeWidth: !0
    }, yf = [
        "Webkit",
        "ms",
        "Moz",
        "O"
    ];
    Object.keys(Hn).forEach(function(e) {
        yf.forEach(function(t) {
            t = t + e.charAt(0).toUpperCase() + e.substring(1), Hn[t] = Hn[e];
        });
    });
    function Gs(e, t, n) {
        return t == null || typeof t == "boolean" || t === "" ? "" : n || typeof t != "number" || t === 0 || Hn.hasOwnProperty(e) && Hn[e] ? ("" + t).trim() : t + "px";
    }
    function Ks(e, t) {
        e = e.style;
        for(var n in t)if (t.hasOwnProperty(n)) {
            var r = n.indexOf("--") === 0, l = Gs(n, t[n], r);
            n === "float" && (n = "cssFloat"), r ? e.setProperty(n, l) : e[n] = l;
        }
    }
    var gf = K({
        menuitem: !0
    }, {
        area: !0,
        base: !0,
        br: !0,
        col: !0,
        embed: !0,
        hr: !0,
        img: !0,
        input: !0,
        keygen: !0,
        link: !0,
        meta: !0,
        param: !0,
        source: !0,
        track: !0,
        wbr: !0
    });
    function Ti(e, t) {
        if (t) {
            if (gf[e] && (t.children != null || t.dangerouslySetInnerHTML != null)) throw Error(S(137, e));
            if (t.dangerouslySetInnerHTML != null) {
                if (t.children != null) throw Error(S(60));
                if (typeof t.dangerouslySetInnerHTML != "object" || !("__html" in t.dangerouslySetInnerHTML)) throw Error(S(61));
            }
            if (t.style != null && typeof t.style != "object") throw Error(S(62));
        }
    }
    function Pi(e, t) {
        if (e.indexOf("-") === -1) return typeof t.is == "string";
        switch(e){
            case "annotation-xml":
            case "color-profile":
            case "font-face":
            case "font-face-src":
            case "font-face-uri":
            case "font-face-format":
            case "font-face-name":
            case "missing-glyph":
                return !1;
            default:
                return !0;
        }
    }
    var Ri = null;
    function ko(e) {
        return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
    }
    var Li = null, dn = null, pn = null;
    function mu(e) {
        if (e = kr(e)) {
            if (typeof Li != "function") throw Error(S(280));
            var t = e.stateNode;
            t && (t = Ll(t), Li(e.stateNode, e.type, t));
        }
    }
    function Ys(e) {
        dn ? pn ? pn.push(e) : pn = [
            e
        ] : dn = e;
    }
    function Xs() {
        if (dn) {
            var e = dn, t = pn;
            if (pn = dn = null, mu(e), t) for(e = 0; e < t.length; e++)mu(t[e]);
        }
    }
    function qs(e, t) {
        return e(t);
    }
    function Zs() {}
    var Ql = !1;
    function Js(e, t, n) {
        if (Ql) return e(t, n);
        Ql = !0;
        try {
            return qs(e, t, n);
        } finally{
            Ql = !1, (dn !== null || pn !== null) && (Zs(), Xs());
        }
    }
    function nr(e, t) {
        var n = e.stateNode;
        if (n === null) return null;
        var r = Ll(n);
        if (r === null) return null;
        n = r[t];
        e: switch(t){
            case "onClick":
            case "onClickCapture":
            case "onDoubleClick":
            case "onDoubleClickCapture":
            case "onMouseDown":
            case "onMouseDownCapture":
            case "onMouseMove":
            case "onMouseMoveCapture":
            case "onMouseUp":
            case "onMouseUpCapture":
            case "onMouseEnter":
                (r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
                break e;
            default:
                e = !1;
        }
        if (e) return null;
        if (n && typeof n != "function") throw Error(S(231, t, typeof n));
        return n;
    }
    var Fi = !1;
    if (lt) try {
        var Fn = {};
        Object.defineProperty(Fn, "passive", {
            get: function() {
                Fi = !0;
            }
        }), window.addEventListener("test", Fn, Fn), window.removeEventListener("test", Fn, Fn);
    } catch  {
        Fi = !1;
    }
    function wf(e, t, n, r, l, i, o, u, s) {
        var a = Array.prototype.slice.call(arguments, 3);
        try {
            t.apply(n, a);
        } catch (v) {
            this.onError(v);
        }
    }
    var Qn = !1, nl = null, rl = !1, ji = null, Sf = {
        onError: function(e) {
            Qn = !0, nl = e;
        }
    };
    function kf(e, t, n, r, l, i, o, u, s) {
        Qn = !1, nl = null, wf.apply(Sf, arguments);
    }
    function xf(e, t, n, r, l, i, o, u, s) {
        if (kf.apply(this, arguments), Qn) {
            if (Qn) {
                var a = nl;
                Qn = !1, nl = null;
            } else throw Error(S(198));
            rl || (rl = !0, ji = a);
        }
    }
    function Yt(e) {
        var t = e, n = e;
        if (e.alternate) for(; t.return;)t = t.return;
        else {
            e = t;
            do t = e, t.flags & 4098 && (n = t.return), e = t.return;
            while (e);
        }
        return t.tag === 3 ? n : null;
    }
    function bs(e) {
        if (e.tag === 13) {
            var t = e.memoizedState;
            if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
        }
        return null;
    }
    function vu(e) {
        if (Yt(e) !== e) throw Error(S(188));
    }
    function Ef(e) {
        var t = e.alternate;
        if (!t) {
            if (t = Yt(e), t === null) throw Error(S(188));
            return t !== e ? null : e;
        }
        for(var n = e, r = t;;){
            var l = n.return;
            if (l === null) break;
            var i = l.alternate;
            if (i === null) {
                if (r = l.return, r !== null) {
                    n = r;
                    continue;
                }
                break;
            }
            if (l.child === i.child) {
                for(i = l.child; i;){
                    if (i === n) return vu(l), e;
                    if (i === r) return vu(l), t;
                    i = i.sibling;
                }
                throw Error(S(188));
            }
            if (n.return !== r.return) n = l, r = i;
            else {
                for(var o = !1, u = l.child; u;){
                    if (u === n) {
                        o = !0, n = l, r = i;
                        break;
                    }
                    if (u === r) {
                        o = !0, r = l, n = i;
                        break;
                    }
                    u = u.sibling;
                }
                if (!o) {
                    for(u = i.child; u;){
                        if (u === n) {
                            o = !0, n = i, r = l;
                            break;
                        }
                        if (u === r) {
                            o = !0, r = i, n = l;
                            break;
                        }
                        u = u.sibling;
                    }
                    if (!o) throw Error(S(189));
                }
            }
            if (n.alternate !== r) throw Error(S(190));
        }
        if (n.tag !== 3) throw Error(S(188));
        return n.stateNode.current === n ? e : t;
    }
    function ea(e) {
        return e = Ef(e), e !== null ? ta(e) : null;
    }
    function ta(e) {
        if (e.tag === 5 || e.tag === 6) return e;
        for(e = e.child; e !== null;){
            var t = ta(e);
            if (t !== null) return t;
            e = e.sibling;
        }
        return null;
    }
    var na = Te.unstable_scheduleCallback, yu = Te.unstable_cancelCallback, _f = Te.unstable_shouldYield, Cf = Te.unstable_requestPaint, q = Te.unstable_now, Nf = Te.unstable_getCurrentPriorityLevel, xo = Te.unstable_ImmediatePriority, ra = Te.unstable_UserBlockingPriority, ll = Te.unstable_NormalPriority, Tf = Te.unstable_LowPriority, la = Te.unstable_IdlePriority, Nl = null, Ye = null;
    function Pf(e) {
        if (Ye && typeof Ye.onCommitFiberRoot == "function") try {
            Ye.onCommitFiberRoot(Nl, e, void 0, (e.current.flags & 128) === 128);
        } catch  {}
    }
    var $e = Math.clz32 ? Math.clz32 : Ff, Rf = Math.log, Lf = Math.LN2;
    function Ff(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (Rf(e) / Lf | 0) | 0;
    }
    var Tr = 64, Pr = 4194304;
    function Un(e) {
        switch(e & -e){
            case 1:
                return 1;
            case 2:
                return 2;
            case 4:
                return 4;
            case 8:
                return 8;
            case 16:
                return 16;
            case 32:
                return 32;
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
                return e & 4194240;
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
                return e & 130023424;
            case 134217728:
                return 134217728;
            case 268435456:
                return 268435456;
            case 536870912:
                return 536870912;
            case 1073741824:
                return 1073741824;
            default:
                return e;
        }
    }
    function il(e, t) {
        var n = e.pendingLanes;
        if (n === 0) return 0;
        var r = 0, l = e.suspendedLanes, i = e.pingedLanes, o = n & 268435455;
        if (o !== 0) {
            var u = o & ~l;
            u !== 0 ? r = Un(u) : (i &= o, i !== 0 && (r = Un(i)));
        } else o = n & ~l, o !== 0 ? r = Un(o) : i !== 0 && (r = Un(i));
        if (r === 0) return 0;
        if (t !== 0 && t !== r && !(t & l) && (l = r & -r, i = t & -t, l >= i || l === 16 && (i & 4194240) !== 0)) return t;
        if (r & 4 && (r |= n & 16), t = e.entangledLanes, t !== 0) for(e = e.entanglements, t &= r; 0 < t;)n = 31 - $e(t), l = 1 << n, r |= e[n], t &= ~l;
        return r;
    }
    function jf(e, t) {
        switch(e){
            case 1:
            case 2:
            case 4:
                return t + 250;
            case 8:
            case 16:
            case 32:
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
                return t + 5e3;
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
                return -1;
            case 134217728:
            case 268435456:
            case 536870912:
            case 1073741824:
                return -1;
            default:
                return -1;
        }
    }
    function zf(e, t) {
        for(var n = e.suspendedLanes, r = e.pingedLanes, l = e.expirationTimes, i = e.pendingLanes; 0 < i;){
            var o = 31 - $e(i), u = 1 << o, s = l[o];
            s === -1 ? (!(u & n) || u & r) && (l[o] = jf(u, t)) : s <= t && (e.expiredLanes |= u), i &= ~u;
        }
    }
    function zi(e) {
        return e = e.pendingLanes & -1073741825, e !== 0 ? e : e & 1073741824 ? 1073741824 : 0;
    }
    function ia() {
        var e = Tr;
        return Tr <<= 1, !(Tr & 4194240) && (Tr = 64), e;
    }
    function Gl(e) {
        for(var t = [], n = 0; 31 > n; n++)t.push(e);
        return t;
    }
    function wr(e, t, n) {
        e.pendingLanes |= t, t !== 536870912 && (e.suspendedLanes = 0, e.pingedLanes = 0), e = e.eventTimes, t = 31 - $e(t), e[t] = n;
    }
    function If(e, t) {
        var n = e.pendingLanes & ~t;
        e.pendingLanes = t, e.suspendedLanes = 0, e.pingedLanes = 0, e.expiredLanes &= t, e.mutableReadLanes &= t, e.entangledLanes &= t, t = e.entanglements;
        var r = e.eventTimes;
        for(e = e.expirationTimes; 0 < n;){
            var l = 31 - $e(n), i = 1 << l;
            t[l] = 0, r[l] = -1, e[l] = -1, n &= ~i;
        }
    }
    function Eo(e, t) {
        var n = e.entangledLanes |= t;
        for(e = e.entanglements; n;){
            var r = 31 - $e(n), l = 1 << r;
            l & t | e[r] & t && (e[r] |= t), n &= ~l;
        }
    }
    var A = 0;
    function oa(e) {
        return e &= -e, 1 < e ? 4 < e ? e & 268435455 ? 16 : 536870912 : 4 : 1;
    }
    var ua, _o, sa, aa, ca, Ii = !1, Rr = [], gt = null, wt = null, St = null, rr = new Map, lr = new Map, ht = [], Mf = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
    function gu(e, t) {
        switch(e){
            case "focusin":
            case "focusout":
                gt = null;
                break;
            case "dragenter":
            case "dragleave":
                wt = null;
                break;
            case "mouseover":
            case "mouseout":
                St = null;
                break;
            case "pointerover":
            case "pointerout":
                rr.delete(t.pointerId);
                break;
            case "gotpointercapture":
            case "lostpointercapture":
                lr.delete(t.pointerId);
        }
    }
    function jn(e, t, n, r, l, i) {
        return e === null || e.nativeEvent !== i ? (e = {
            blockedOn: t,
            domEventName: n,
            eventSystemFlags: r,
            nativeEvent: i,
            targetContainers: [
                l
            ]
        }, t !== null && (t = kr(t), t !== null && _o(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, l !== null && t.indexOf(l) === -1 && t.push(l), e);
    }
    function Of(e, t, n, r, l) {
        switch(t){
            case "focusin":
                return gt = jn(gt, e, t, n, r, l), !0;
            case "dragenter":
                return wt = jn(wt, e, t, n, r, l), !0;
            case "mouseover":
                return St = jn(St, e, t, n, r, l), !0;
            case "pointerover":
                var i = l.pointerId;
                return rr.set(i, jn(rr.get(i) || null, e, t, n, r, l)), !0;
            case "gotpointercapture":
                return i = l.pointerId, lr.set(i, jn(lr.get(i) || null, e, t, n, r, l)), !0;
        }
        return !1;
    }
    function fa(e) {
        var t = Dt(e.target);
        if (t !== null) {
            var n = Yt(t);
            if (n !== null) {
                if (t = n.tag, t === 13) {
                    if (t = bs(n), t !== null) {
                        e.blockedOn = t, ca(e.priority, function() {
                            sa(n);
                        });
                        return;
                    }
                } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
                    e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
                    return;
                }
            }
        }
        e.blockedOn = null;
    }
    function Hr(e) {
        if (e.blockedOn !== null) return !1;
        for(var t = e.targetContainers; 0 < t.length;){
            var n = Mi(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
            if (n === null) {
                n = e.nativeEvent;
                var r = new n.constructor(n.type, n);
                Ri = r, n.target.dispatchEvent(r), Ri = null;
            } else return t = kr(n), t !== null && _o(t), e.blockedOn = n, !1;
            t.shift();
        }
        return !0;
    }
    function wu(e, t, n) {
        Hr(e) && n.delete(t);
    }
    function Df() {
        Ii = !1, gt !== null && Hr(gt) && (gt = null), wt !== null && Hr(wt) && (wt = null), St !== null && Hr(St) && (St = null), rr.forEach(wu), lr.forEach(wu);
    }
    function zn(e, t) {
        e.blockedOn === t && (e.blockedOn = null, Ii || (Ii = !0, Te.unstable_scheduleCallback(Te.unstable_NormalPriority, Df)));
    }
    function ir(e) {
        function t(l) {
            return zn(l, e);
        }
        if (0 < Rr.length) {
            zn(Rr[0], e);
            for(var n = 1; n < Rr.length; n++){
                var r = Rr[n];
                r.blockedOn === e && (r.blockedOn = null);
            }
        }
        for(gt !== null && zn(gt, e), wt !== null && zn(wt, e), St !== null && zn(St, e), rr.forEach(t), lr.forEach(t), n = 0; n < ht.length; n++)r = ht[n], r.blockedOn === e && (r.blockedOn = null);
        for(; 0 < ht.length && (n = ht[0], n.blockedOn === null);)fa(n), n.blockedOn === null && ht.shift();
    }
    var hn = st.ReactCurrentBatchConfig, ol = !0;
    function Af(e, t, n, r) {
        var l = A, i = hn.transition;
        hn.transition = null;
        try {
            A = 1, Co(e, t, n, r);
        } finally{
            A = l, hn.transition = i;
        }
    }
    function Vf(e, t, n, r) {
        var l = A, i = hn.transition;
        hn.transition = null;
        try {
            A = 4, Co(e, t, n, r);
        } finally{
            A = l, hn.transition = i;
        }
    }
    function Co(e, t, n, r) {
        if (ol) {
            var l = Mi(e, t, n, r);
            if (l === null) ni(e, t, r, ul, n), gu(e, r);
            else if (Of(l, e, t, n, r)) r.stopPropagation();
            else if (gu(e, r), t & 4 && -1 < Mf.indexOf(e)) {
                for(; l !== null;){
                    var i = kr(l);
                    if (i !== null && ua(i), i = Mi(e, t, n, r), i === null && ni(e, t, r, ul, n), i === l) break;
                    l = i;
                }
                l !== null && r.stopPropagation();
            } else ni(e, t, r, null, n);
        }
    }
    var ul = null;
    function Mi(e, t, n, r) {
        if (ul = null, e = ko(r), e = Dt(e), e !== null) if (t = Yt(e), t === null) e = null;
        else if (n = t.tag, n === 13) {
            if (e = bs(t), e !== null) return e;
            e = null;
        } else if (n === 3) {
            if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
            e = null;
        } else t !== e && (e = null);
        return ul = e, null;
    }
    function da(e) {
        switch(e){
            case "cancel":
            case "click":
            case "close":
            case "contextmenu":
            case "copy":
            case "cut":
            case "auxclick":
            case "dblclick":
            case "dragend":
            case "dragstart":
            case "drop":
            case "focusin":
            case "focusout":
            case "input":
            case "invalid":
            case "keydown":
            case "keypress":
            case "keyup":
            case "mousedown":
            case "mouseup":
            case "paste":
            case "pause":
            case "play":
            case "pointercancel":
            case "pointerdown":
            case "pointerup":
            case "ratechange":
            case "reset":
            case "resize":
            case "seeked":
            case "submit":
            case "touchcancel":
            case "touchend":
            case "touchstart":
            case "volumechange":
            case "change":
            case "selectionchange":
            case "textInput":
            case "compositionstart":
            case "compositionend":
            case "compositionupdate":
            case "beforeblur":
            case "afterblur":
            case "beforeinput":
            case "blur":
            case "fullscreenchange":
            case "focus":
            case "hashchange":
            case "popstate":
            case "select":
            case "selectstart":
                return 1;
            case "drag":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "mousemove":
            case "mouseout":
            case "mouseover":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "scroll":
            case "toggle":
            case "touchmove":
            case "wheel":
            case "mouseenter":
            case "mouseleave":
            case "pointerenter":
            case "pointerleave":
                return 4;
            case "message":
                switch(Nf()){
                    case xo:
                        return 1;
                    case ra:
                        return 4;
                    case ll:
                    case Tf:
                        return 16;
                    case la:
                        return 536870912;
                    default:
                        return 16;
                }
            default:
                return 16;
        }
    }
    var vt = null, No = null, Qr = null;
    function pa() {
        if (Qr) return Qr;
        var e, t = No, n = t.length, r, l = "value" in vt ? vt.value : vt.textContent, i = l.length;
        for(e = 0; e < n && t[e] === l[e]; e++);
        var o = n - e;
        for(r = 1; r <= o && t[n - r] === l[i - r]; r++);
        return Qr = l.slice(e, 1 < r ? 1 - r : void 0);
    }
    function Gr(e) {
        var t = e.keyCode;
        return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
    }
    function Lr() {
        return !0;
    }
    function Su() {
        return !1;
    }
    function Re(e) {
        function t(n, r, l, i, o) {
            this._reactName = n, this._targetInst = l, this.type = r, this.nativeEvent = i, this.target = o, this.currentTarget = null;
            for(var u in e)e.hasOwnProperty(u) && (n = e[u], this[u] = n ? n(i) : i[u]);
            return this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? Lr : Su, this.isPropagationStopped = Su, this;
        }
        return K(t.prototype, {
            preventDefault: function() {
                this.defaultPrevented = !0;
                var n = this.nativeEvent;
                n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = Lr);
            },
            stopPropagation: function() {
                var n = this.nativeEvent;
                n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = Lr);
            },
            persist: function() {},
            isPersistent: Lr
        }), t;
    }
    var Cn = {
        eventPhase: 0,
        bubbles: 0,
        cancelable: 0,
        timeStamp: function(e) {
            return e.timeStamp || Date.now();
        },
        defaultPrevented: 0,
        isTrusted: 0
    }, To = Re(Cn), Sr = K({}, Cn, {
        view: 0,
        detail: 0
    }), Uf = Re(Sr), Kl, Yl, In, Tl = K({}, Sr, {
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        pageX: 0,
        pageY: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        getModifierState: Po,
        button: 0,
        buttons: 0,
        relatedTarget: function(e) {
            return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
        },
        movementX: function(e) {
            return "movementX" in e ? e.movementX : (e !== In && (In && e.type === "mousemove" ? (Kl = e.screenX - In.screenX, Yl = e.screenY - In.screenY) : Yl = Kl = 0, In = e), Kl);
        },
        movementY: function(e) {
            return "movementY" in e ? e.movementY : Yl;
        }
    }), ku = Re(Tl), Wf = K({}, Tl, {
        dataTransfer: 0
    }), $f = Re(Wf), Bf = K({}, Sr, {
        relatedTarget: 0
    }), Xl = Re(Bf), Hf = K({}, Cn, {
        animationName: 0,
        elapsedTime: 0,
        pseudoElement: 0
    }), Qf = Re(Hf), Gf = K({}, Cn, {
        clipboardData: function(e) {
            return "clipboardData" in e ? e.clipboardData : window.clipboardData;
        }
    }), Kf = Re(Gf), Yf = K({}, Cn, {
        data: 0
    }), xu = Re(Yf), Xf = {
        Esc: "Escape",
        Spacebar: " ",
        Left: "ArrowLeft",
        Up: "ArrowUp",
        Right: "ArrowRight",
        Down: "ArrowDown",
        Del: "Delete",
        Win: "OS",
        Menu: "ContextMenu",
        Apps: "ContextMenu",
        Scroll: "ScrollLock",
        MozPrintableKey: "Unidentified"
    }, qf = {
        8: "Backspace",
        9: "Tab",
        12: "Clear",
        13: "Enter",
        16: "Shift",
        17: "Control",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Escape",
        32: " ",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        45: "Insert",
        46: "Delete",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        144: "NumLock",
        145: "ScrollLock",
        224: "Meta"
    }, Zf = {
        Alt: "altKey",
        Control: "ctrlKey",
        Meta: "metaKey",
        Shift: "shiftKey"
    };
    function Jf(e) {
        var t = this.nativeEvent;
        return t.getModifierState ? t.getModifierState(e) : (e = Zf[e]) ? !!t[e] : !1;
    }
    function Po() {
        return Jf;
    }
    var bf = K({}, Sr, {
        key: function(e) {
            if (e.key) {
                var t = Xf[e.key] || e.key;
                if (t !== "Unidentified") return t;
            }
            return e.type === "keypress" ? (e = Gr(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? qf[e.keyCode] || "Unidentified" : "";
        },
        code: 0,
        location: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        repeat: 0,
        locale: 0,
        getModifierState: Po,
        charCode: function(e) {
            return e.type === "keypress" ? Gr(e) : 0;
        },
        keyCode: function(e) {
            return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
        },
        which: function(e) {
            return e.type === "keypress" ? Gr(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
        }
    }), ed = Re(bf), td = K({}, Tl, {
        pointerId: 0,
        width: 0,
        height: 0,
        pressure: 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: 0,
        isPrimary: 0
    }), Eu = Re(td), nd = K({}, Sr, {
        touches: 0,
        targetTouches: 0,
        changedTouches: 0,
        altKey: 0,
        metaKey: 0,
        ctrlKey: 0,
        shiftKey: 0,
        getModifierState: Po
    }), rd = Re(nd), ld = K({}, Cn, {
        propertyName: 0,
        elapsedTime: 0,
        pseudoElement: 0
    }), id = Re(ld), od = K({}, Tl, {
        deltaX: function(e) {
            return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
        },
        deltaY: function(e) {
            return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0
    }), ud = Re(od), sd = [
        9,
        13,
        27,
        32
    ], Ro = lt && "CompositionEvent" in window, Gn = null;
    lt && "documentMode" in document && (Gn = document.documentMode);
    var ad = lt && "TextEvent" in window && !Gn, ha = lt && (!Ro || Gn && 8 < Gn && 11 >= Gn), _u = " ", Cu = !1;
    function ma(e, t) {
        switch(e){
            case "keyup":
                return sd.indexOf(t.keyCode) !== -1;
            case "keydown":
                return t.keyCode !== 229;
            case "keypress":
            case "mousedown":
            case "focusout":
                return !0;
            default:
                return !1;
        }
    }
    function va(e) {
        return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
    }
    var en = !1;
    function cd(e, t) {
        switch(e){
            case "compositionend":
                return va(t);
            case "keypress":
                return t.which !== 32 ? null : (Cu = !0, _u);
            case "textInput":
                return e = t.data, e === _u && Cu ? null : e;
            default:
                return null;
        }
    }
    function fd(e, t) {
        if (en) return e === "compositionend" || !Ro && ma(e, t) ? (e = pa(), Qr = No = vt = null, en = !1, e) : null;
        switch(e){
            case "paste":
                return null;
            case "keypress":
                if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
                    if (t.char && 1 < t.char.length) return t.char;
                    if (t.which) return String.fromCharCode(t.which);
                }
                return null;
            case "compositionend":
                return ha && t.locale !== "ko" ? null : t.data;
            default:
                return null;
        }
    }
    var dd = {
        color: !0,
        date: !0,
        datetime: !0,
        "datetime-local": !0,
        email: !0,
        month: !0,
        number: !0,
        password: !0,
        range: !0,
        search: !0,
        tel: !0,
        text: !0,
        time: !0,
        url: !0,
        week: !0
    };
    function Nu(e) {
        var t = e && e.nodeName && e.nodeName.toLowerCase();
        return t === "input" ? !!dd[e.type] : t === "textarea";
    }
    function ya(e, t, n, r) {
        Ys(r), t = sl(t, "onChange"), 0 < t.length && (n = new To("onChange", "change", null, n, r), e.push({
            event: n,
            listeners: t
        }));
    }
    var Kn = null, or = null;
    function pd(e) {
        Pa(e, 0);
    }
    function Pl(e) {
        var t = rn(e);
        if (Ws(t)) return e;
    }
    function hd(e, t) {
        if (e === "change") return t;
    }
    var ga = !1;
    if (lt) {
        var ql;
        if (lt) {
            var Zl = "oninput" in document;
            if (!Zl) {
                var Tu = document.createElement("div");
                Tu.setAttribute("oninput", "return;"), Zl = typeof Tu.oninput == "function";
            }
            ql = Zl;
        } else ql = !1;
        ga = ql && (!document.documentMode || 9 < document.documentMode);
    }
    function Pu() {
        Kn && (Kn.detachEvent("onpropertychange", wa), or = Kn = null);
    }
    function wa(e) {
        if (e.propertyName === "value" && Pl(or)) {
            var t = [];
            ya(t, or, e, ko(e)), Js(pd, t);
        }
    }
    function md(e, t, n) {
        e === "focusin" ? (Pu(), Kn = t, or = n, Kn.attachEvent("onpropertychange", wa)) : e === "focusout" && Pu();
    }
    function vd(e) {
        if (e === "selectionchange" || e === "keyup" || e === "keydown") return Pl(or);
    }
    function yd(e, t) {
        if (e === "click") return Pl(t);
    }
    function gd(e, t) {
        if (e === "input" || e === "change") return Pl(t);
    }
    function wd(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
    }
    var He = typeof Object.is == "function" ? Object.is : wd;
    function ur(e, t) {
        if (He(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null) return !1;
        var n = Object.keys(e), r = Object.keys(t);
        if (n.length !== r.length) return !1;
        for(r = 0; r < n.length; r++){
            var l = n[r];
            if (!yi.call(t, l) || !He(e[l], t[l])) return !1;
        }
        return !0;
    }
    function Ru(e) {
        for(; e && e.firstChild;)e = e.firstChild;
        return e;
    }
    function Lu(e, t) {
        var n = Ru(e);
        e = 0;
        for(var r; n;){
            if (n.nodeType === 3) {
                if (r = e + n.textContent.length, e <= t && r >= t) return {
                    node: n,
                    offset: t - e
                };
                e = r;
            }
            e: {
                for(; n;){
                    if (n.nextSibling) {
                        n = n.nextSibling;
                        break e;
                    }
                    n = n.parentNode;
                }
                n = void 0;
            }
            n = Ru(n);
        }
    }
    function Sa(e, t) {
        return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Sa(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
    }
    function ka() {
        for(var e = window, t = tl(); t instanceof e.HTMLIFrameElement;){
            try {
                var n = typeof t.contentWindow.location.href == "string";
            } catch  {
                n = !1;
            }
            if (n) e = t.contentWindow;
            else break;
            t = tl(e.document);
        }
        return t;
    }
    function Lo(e) {
        var t = e && e.nodeName && e.nodeName.toLowerCase();
        return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
    }
    function Sd(e) {
        var t = ka(), n = e.focusedElem, r = e.selectionRange;
        if (t !== n && n && n.ownerDocument && Sa(n.ownerDocument.documentElement, n)) {
            if (r !== null && Lo(n)) {
                if (t = r.start, e = r.end, e === void 0 && (e = t), "selectionStart" in n) n.selectionStart = t, n.selectionEnd = Math.min(e, n.value.length);
                else if (e = (t = n.ownerDocument || document) && t.defaultView || window, e.getSelection) {
                    e = e.getSelection();
                    var l = n.textContent.length, i = Math.min(r.start, l);
                    r = r.end === void 0 ? i : Math.min(r.end, l), !e.extend && i > r && (l = r, r = i, i = l), l = Lu(n, i);
                    var o = Lu(n, r);
                    l && o && (e.rangeCount !== 1 || e.anchorNode !== l.node || e.anchorOffset !== l.offset || e.focusNode !== o.node || e.focusOffset !== o.offset) && (t = t.createRange(), t.setStart(l.node, l.offset), e.removeAllRanges(), i > r ? (e.addRange(t), e.extend(o.node, o.offset)) : (t.setEnd(o.node, o.offset), e.addRange(t)));
                }
            }
            for(t = [], e = n; e = e.parentNode;)e.nodeType === 1 && t.push({
                element: e,
                left: e.scrollLeft,
                top: e.scrollTop
            });
            for(typeof n.focus == "function" && n.focus(), n = 0; n < t.length; n++)e = t[n], e.element.scrollLeft = e.left, e.element.scrollTop = e.top;
        }
    }
    var kd = lt && "documentMode" in document && 11 >= document.documentMode, tn = null, Oi = null, Yn = null, Di = !1;
    function Fu(e, t, n) {
        var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
        Di || tn == null || tn !== tl(r) || (r = tn, "selectionStart" in r && Lo(r) ? r = {
            start: r.selectionStart,
            end: r.selectionEnd
        } : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
            anchorNode: r.anchorNode,
            anchorOffset: r.anchorOffset,
            focusNode: r.focusNode,
            focusOffset: r.focusOffset
        }), Yn && ur(Yn, r) || (Yn = r, r = sl(Oi, "onSelect"), 0 < r.length && (t = new To("onSelect", "select", null, t, n), e.push({
            event: t,
            listeners: r
        }), t.target = tn)));
    }
    function Fr(e, t) {
        var n = {};
        return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
    }
    var nn = {
        animationend: Fr("Animation", "AnimationEnd"),
        animationiteration: Fr("Animation", "AnimationIteration"),
        animationstart: Fr("Animation", "AnimationStart"),
        transitionend: Fr("Transition", "TransitionEnd")
    }, Jl = {}, xa = {};
    lt && (xa = document.createElement("div").style, "AnimationEvent" in window || (delete nn.animationend.animation, delete nn.animationiteration.animation, delete nn.animationstart.animation), "TransitionEvent" in window || delete nn.transitionend.transition);
    function Rl(e) {
        if (Jl[e]) return Jl[e];
        if (!nn[e]) return e;
        var t = nn[e], n;
        for(n in t)if (t.hasOwnProperty(n) && n in xa) return Jl[e] = t[n];
        return e;
    }
    var Ea = Rl("animationend"), _a = Rl("animationiteration"), Ca = Rl("animationstart"), Na = Rl("transitionend"), Ta = new Map, ju = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
    function Pt(e, t) {
        Ta.set(e, t), Kt(t, [
            e
        ]);
    }
    for(var bl = 0; bl < ju.length; bl++){
        var ei = ju[bl], xd = ei.toLowerCase(), Ed = ei[0].toUpperCase() + ei.slice(1);
        Pt(xd, "on" + Ed);
    }
    Pt(Ea, "onAnimationEnd");
    Pt(_a, "onAnimationIteration");
    Pt(Ca, "onAnimationStart");
    Pt("dblclick", "onDoubleClick");
    Pt("focusin", "onFocus");
    Pt("focusout", "onBlur");
    Pt(Na, "onTransitionEnd");
    yn("onMouseEnter", [
        "mouseout",
        "mouseover"
    ]);
    yn("onMouseLeave", [
        "mouseout",
        "mouseover"
    ]);
    yn("onPointerEnter", [
        "pointerout",
        "pointerover"
    ]);
    yn("onPointerLeave", [
        "pointerout",
        "pointerover"
    ]);
    Kt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
    Kt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
    Kt("onBeforeInput", [
        "compositionend",
        "keypress",
        "textInput",
        "paste"
    ]);
    Kt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
    Kt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
    Kt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
    var Wn = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), _d = new Set("cancel close invalid load scroll toggle".split(" ").concat(Wn));
    function zu(e, t, n) {
        var r = e.type || "unknown-event";
        e.currentTarget = n, xf(r, t, void 0, e), e.currentTarget = null;
    }
    function Pa(e, t) {
        t = (t & 4) !== 0;
        for(var n = 0; n < e.length; n++){
            var r = e[n], l = r.event;
            r = r.listeners;
            e: {
                var i = void 0;
                if (t) for(var o = r.length - 1; 0 <= o; o--){
                    var u = r[o], s = u.instance, a = u.currentTarget;
                    if (u = u.listener, s !== i && l.isPropagationStopped()) break e;
                    zu(l, u, a), i = s;
                }
                else for(o = 0; o < r.length; o++){
                    if (u = r[o], s = u.instance, a = u.currentTarget, u = u.listener, s !== i && l.isPropagationStopped()) break e;
                    zu(l, u, a), i = s;
                }
            }
        }
        if (rl) throw e = ji, rl = !1, ji = null, e;
    }
    function U(e, t) {
        var n = t[$i];
        n === void 0 && (n = t[$i] = new Set);
        var r = e + "__bubble";
        n.has(r) || (Ra(t, e, 2, !1), n.add(r));
    }
    function ti(e, t, n) {
        var r = 0;
        t && (r |= 4), Ra(n, e, r, t);
    }
    var jr = "_reactListening" + Math.random().toString(36).slice(2);
    function sr(e) {
        if (!e[jr]) {
            e[jr] = !0, Os.forEach(function(n) {
                n !== "selectionchange" && (_d.has(n) || ti(n, !1, e), ti(n, !0, e));
            });
            var t = e.nodeType === 9 ? e : e.ownerDocument;
            t === null || t[jr] || (t[jr] = !0, ti("selectionchange", !1, t));
        }
    }
    function Ra(e, t, n, r) {
        switch(da(t)){
            case 1:
                var l = Af;
                break;
            case 4:
                l = Vf;
                break;
            default:
                l = Co;
        }
        n = l.bind(null, t, n, e), l = void 0, !Fi || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (l = !0), r ? l !== void 0 ? e.addEventListener(t, n, {
            capture: !0,
            passive: l
        }) : e.addEventListener(t, n, !0) : l !== void 0 ? e.addEventListener(t, n, {
            passive: l
        }) : e.addEventListener(t, n, !1);
    }
    function ni(e, t, n, r, l) {
        var i = r;
        if (!(t & 1) && !(t & 2) && r !== null) e: for(;;){
            if (r === null) return;
            var o = r.tag;
            if (o === 3 || o === 4) {
                var u = r.stateNode.containerInfo;
                if (u === l || u.nodeType === 8 && u.parentNode === l) break;
                if (o === 4) for(o = r.return; o !== null;){
                    var s = o.tag;
                    if ((s === 3 || s === 4) && (s = o.stateNode.containerInfo, s === l || s.nodeType === 8 && s.parentNode === l)) return;
                    o = o.return;
                }
                for(; u !== null;){
                    if (o = Dt(u), o === null) return;
                    if (s = o.tag, s === 5 || s === 6) {
                        r = i = o;
                        continue e;
                    }
                    u = u.parentNode;
                }
            }
            r = r.return;
        }
        Js(function() {
            var a = i, v = ko(n), m = [];
            e: {
                var p = Ta.get(e);
                if (p !== void 0) {
                    var g = To, k = e;
                    switch(e){
                        case "keypress":
                            if (Gr(n) === 0) break e;
                        case "keydown":
                        case "keyup":
                            g = ed;
                            break;
                        case "focusin":
                            k = "focus", g = Xl;
                            break;
                        case "focusout":
                            k = "blur", g = Xl;
                            break;
                        case "beforeblur":
                        case "afterblur":
                            g = Xl;
                            break;
                        case "click":
                            if (n.button === 2) break e;
                        case "auxclick":
                        case "dblclick":
                        case "mousedown":
                        case "mousemove":
                        case "mouseup":
                        case "mouseout":
                        case "mouseover":
                        case "contextmenu":
                            g = ku;
                            break;
                        case "drag":
                        case "dragend":
                        case "dragenter":
                        case "dragexit":
                        case "dragleave":
                        case "dragover":
                        case "dragstart":
                        case "drop":
                            g = $f;
                            break;
                        case "touchcancel":
                        case "touchend":
                        case "touchmove":
                        case "touchstart":
                            g = rd;
                            break;
                        case Ea:
                        case _a:
                        case Ca:
                            g = Qf;
                            break;
                        case Na:
                            g = id;
                            break;
                        case "scroll":
                            g = Uf;
                            break;
                        case "wheel":
                            g = ud;
                            break;
                        case "copy":
                        case "cut":
                        case "paste":
                            g = Kf;
                            break;
                        case "gotpointercapture":
                        case "lostpointercapture":
                        case "pointercancel":
                        case "pointerdown":
                        case "pointermove":
                        case "pointerout":
                        case "pointerover":
                        case "pointerup":
                            g = Eu;
                    }
                    var E = (t & 4) !== 0, O = !E && e === "scroll", f = E ? p !== null ? p + "Capture" : null : p;
                    E = [];
                    for(var c = a, d; c !== null;){
                        d = c;
                        var w = d.stateNode;
                        if (d.tag === 5 && w !== null && (d = w, f !== null && (w = nr(c, f), w != null && E.push(ar(c, w, d)))), O) break;
                        c = c.return;
                    }
                    0 < E.length && (p = new g(p, k, null, n, v), m.push({
                        event: p,
                        listeners: E
                    }));
                }
            }
            if (!(t & 7)) {
                e: {
                    if (p = e === "mouseover" || e === "pointerover", g = e === "mouseout" || e === "pointerout", p && n !== Ri && (k = n.relatedTarget || n.fromElement) && (Dt(k) || k[it])) break e;
                    if ((g || p) && (p = v.window === v ? v : (p = v.ownerDocument) ? p.defaultView || p.parentWindow : window, g ? (k = n.relatedTarget || n.toElement, g = a, k = k ? Dt(k) : null, k !== null && (O = Yt(k), k !== O || k.tag !== 5 && k.tag !== 6) && (k = null)) : (g = null, k = a), g !== k)) {
                        if (E = ku, w = "onMouseLeave", f = "onMouseEnter", c = "mouse", (e === "pointerout" || e === "pointerover") && (E = Eu, w = "onPointerLeave", f = "onPointerEnter", c = "pointer"), O = g == null ? p : rn(g), d = k == null ? p : rn(k), p = new E(w, c + "leave", g, n, v), p.target = O, p.relatedTarget = d, w = null, Dt(v) === a && (E = new E(f, c + "enter", k, n, v), E.target = d, E.relatedTarget = O, w = E), O = w, g && k) t: {
                            for(E = g, f = k, c = 0, d = E; d; d = qt(d))c++;
                            for(d = 0, w = f; w; w = qt(w))d++;
                            for(; 0 < c - d;)E = qt(E), c--;
                            for(; 0 < d - c;)f = qt(f), d--;
                            for(; c--;){
                                if (E === f || f !== null && E === f.alternate) break t;
                                E = qt(E), f = qt(f);
                            }
                            E = null;
                        }
                        else E = null;
                        g !== null && Iu(m, p, g, E, !1), k !== null && O !== null && Iu(m, O, k, E, !0);
                    }
                }
                e: {
                    if (p = a ? rn(a) : window, g = p.nodeName && p.nodeName.toLowerCase(), g === "select" || g === "input" && p.type === "file") var _ = hd;
                    else if (Nu(p)) if (ga) _ = gd;
                    else {
                        _ = vd;
                        var T = md;
                    }
                    else (g = p.nodeName) && g.toLowerCase() === "input" && (p.type === "checkbox" || p.type === "radio") && (_ = yd);
                    if (_ && (_ = _(e, a))) {
                        ya(m, _, n, v);
                        break e;
                    }
                    T && T(e, p, a), e === "focusout" && (T = p._wrapperState) && T.controlled && p.type === "number" && _i(p, "number", p.value);
                }
                switch(T = a ? rn(a) : window, e){
                    case "focusin":
                        (Nu(T) || T.contentEditable === "true") && (tn = T, Oi = a, Yn = null);
                        break;
                    case "focusout":
                        Yn = Oi = tn = null;
                        break;
                    case "mousedown":
                        Di = !0;
                        break;
                    case "contextmenu":
                    case "mouseup":
                    case "dragend":
                        Di = !1, Fu(m, n, v);
                        break;
                    case "selectionchange":
                        if (kd) break;
                    case "keydown":
                    case "keyup":
                        Fu(m, n, v);
                }
                var P;
                if (Ro) e: {
                    switch(e){
                        case "compositionstart":
                            var R = "onCompositionStart";
                            break e;
                        case "compositionend":
                            R = "onCompositionEnd";
                            break e;
                        case "compositionupdate":
                            R = "onCompositionUpdate";
                            break e;
                    }
                    R = void 0;
                }
                else en ? ma(e, n) && (R = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (R = "onCompositionStart");
                R && (ha && n.locale !== "ko" && (en || R !== "onCompositionStart" ? R === "onCompositionEnd" && en && (P = pa()) : (vt = v, No = "value" in vt ? vt.value : vt.textContent, en = !0)), T = sl(a, R), 0 < T.length && (R = new xu(R, e, null, n, v), m.push({
                    event: R,
                    listeners: T
                }), P ? R.data = P : (P = va(n), P !== null && (R.data = P)))), (P = ad ? cd(e, n) : fd(e, n)) && (a = sl(a, "onBeforeInput"), 0 < a.length && (v = new xu("onBeforeInput", "beforeinput", null, n, v), m.push({
                    event: v,
                    listeners: a
                }), v.data = P));
            }
            Pa(m, t);
        });
    }
    function ar(e, t, n) {
        return {
            instance: e,
            listener: t,
            currentTarget: n
        };
    }
    function sl(e, t) {
        for(var n = t + "Capture", r = []; e !== null;){
            var l = e, i = l.stateNode;
            l.tag === 5 && i !== null && (l = i, i = nr(e, n), i != null && r.unshift(ar(e, i, l)), i = nr(e, t), i != null && r.push(ar(e, i, l))), e = e.return;
        }
        return r;
    }
    function qt(e) {
        if (e === null) return null;
        do e = e.return;
        while (e && e.tag !== 5);
        return e || null;
    }
    function Iu(e, t, n, r, l) {
        for(var i = t._reactName, o = []; n !== null && n !== r;){
            var u = n, s = u.alternate, a = u.stateNode;
            if (s !== null && s === r) break;
            u.tag === 5 && a !== null && (u = a, l ? (s = nr(n, i), s != null && o.unshift(ar(n, s, u))) : l || (s = nr(n, i), s != null && o.push(ar(n, s, u)))), n = n.return;
        }
        o.length !== 0 && e.push({
            event: t,
            listeners: o
        });
    }
    var Cd = /\r\n?/g, Nd = /\u0000|\uFFFD/g;
    function Mu(e) {
        return (typeof e == "string" ? e : "" + e).replace(Cd, `
`).replace(Nd, "");
    }
    function zr(e, t, n) {
        if (t = Mu(t), Mu(e) !== t && n) throw Error(S(425));
    }
    function al() {}
    var Ai = null, Vi = null;
    function Ui(e, t) {
        return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
    }
    var Wi = typeof setTimeout == "function" ? setTimeout : void 0, Td = typeof clearTimeout == "function" ? clearTimeout : void 0, Ou = typeof Promise == "function" ? Promise : void 0, Pd = typeof queueMicrotask == "function" ? queueMicrotask : typeof Ou < "u" ? function(e) {
        return Ou.resolve(null).then(e).catch(Rd);
    } : Wi;
    function Rd(e) {
        setTimeout(function() {
            throw e;
        });
    }
    function ri(e, t) {
        var n = t, r = 0;
        do {
            var l = n.nextSibling;
            if (e.removeChild(n), l && l.nodeType === 8) if (n = l.data, n === "/$") {
                if (r === 0) {
                    e.removeChild(l), ir(t);
                    return;
                }
                r--;
            } else n !== "$" && n !== "$?" && n !== "$!" || r++;
            n = l;
        }while (n);
        ir(t);
    }
    function kt(e) {
        for(; e != null; e = e.nextSibling){
            var t = e.nodeType;
            if (t === 1 || t === 3) break;
            if (t === 8) {
                if (t = e.data, t === "$" || t === "$!" || t === "$?") break;
                if (t === "/$") return null;
            }
        }
        return e;
    }
    function Du(e) {
        e = e.previousSibling;
        for(var t = 0; e;){
            if (e.nodeType === 8) {
                var n = e.data;
                if (n === "$" || n === "$!" || n === "$?") {
                    if (t === 0) return e;
                    t--;
                } else n === "/$" && t++;
            }
            e = e.previousSibling;
        }
        return null;
    }
    var Nn = Math.random().toString(36).slice(2), Ke = "__reactFiber$" + Nn, cr = "__reactProps$" + Nn, it = "__reactContainer$" + Nn, $i = "__reactEvents$" + Nn, Ld = "__reactListeners$" + Nn, Fd = "__reactHandles$" + Nn;
    function Dt(e) {
        var t = e[Ke];
        if (t) return t;
        for(var n = e.parentNode; n;){
            if (t = n[it] || n[Ke]) {
                if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for(e = Du(e); e !== null;){
                    if (n = e[Ke]) return n;
                    e = Du(e);
                }
                return t;
            }
            e = n, n = e.parentNode;
        }
        return null;
    }
    function kr(e) {
        return e = e[Ke] || e[it], !e || e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3 ? null : e;
    }
    function rn(e) {
        if (e.tag === 5 || e.tag === 6) return e.stateNode;
        throw Error(S(33));
    }
    function Ll(e) {
        return e[cr] || null;
    }
    var Bi = [], ln = -1;
    function Rt(e) {
        return {
            current: e
        };
    }
    function W(e) {
        0 > ln || (e.current = Bi[ln], Bi[ln] = null, ln--);
    }
    function V(e, t) {
        ln++, Bi[ln] = e.current, e.current = t;
    }
    var Tt = {}, de = Rt(Tt), ke = Rt(!1), $t = Tt;
    function gn(e, t) {
        var n = e.type.contextTypes;
        if (!n) return Tt;
        var r = e.stateNode;
        if (r && r.__reactInternalMemoizedUnmaskedChildContext === t) return r.__reactInternalMemoizedMaskedChildContext;
        var l = {}, i;
        for(i in n)l[i] = t[i];
        return r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = t, e.__reactInternalMemoizedMaskedChildContext = l), l;
    }
    function xe(e) {
        return e = e.childContextTypes, e != null;
    }
    function cl() {
        W(ke), W(de);
    }
    function Au(e, t, n) {
        if (de.current !== Tt) throw Error(S(168));
        V(de, t), V(ke, n);
    }
    function La(e, t, n) {
        var r = e.stateNode;
        if (t = t.childContextTypes, typeof r.getChildContext != "function") return n;
        r = r.getChildContext();
        for(var l in r)if (!(l in t)) throw Error(S(108, mf(e) || "Unknown", l));
        return K({}, n, r);
    }
    function fl(e) {
        return e = (e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext || Tt, $t = de.current, V(de, e), V(ke, ke.current), !0;
    }
    function Vu(e, t, n) {
        var r = e.stateNode;
        if (!r) throw Error(S(169));
        n ? (e = La(e, t, $t), r.__reactInternalMemoizedMergedChildContext = e, W(ke), W(de), V(de, e)) : W(ke), V(ke, n);
    }
    var be = null, Fl = !1, li = !1;
    function Fa(e) {
        be === null ? be = [
            e
        ] : be.push(e);
    }
    function jd(e) {
        Fl = !0, Fa(e);
    }
    function Lt() {
        if (!li && be !== null) {
            li = !0;
            var e = 0, t = A;
            try {
                var n = be;
                for(A = 1; e < n.length; e++){
                    var r = n[e];
                    do r = r(!0);
                    while (r !== null);
                }
                be = null, Fl = !1;
            } catch (l) {
                throw be !== null && (be = be.slice(e + 1)), na(xo, Lt), l;
            } finally{
                A = t, li = !1;
            }
        }
        return null;
    }
    var on = [], un = 0, dl = null, pl = 0, je = [], ze = 0, Bt = null, tt = 1, nt = "";
    function zt(e, t) {
        on[un++] = pl, on[un++] = dl, dl = e, pl = t;
    }
    function ja(e, t, n) {
        je[ze++] = tt, je[ze++] = nt, je[ze++] = Bt, Bt = e;
        var r = tt;
        e = nt;
        var l = 32 - $e(r) - 1;
        r &= ~(1 << l), n += 1;
        var i = 32 - $e(t) + l;
        if (30 < i) {
            var o = l - l % 5;
            i = (r & (1 << o) - 1).toString(32), r >>= o, l -= o, tt = 1 << 32 - $e(t) + l | n << l | r, nt = i + e;
        } else tt = 1 << i | n << l | r, nt = e;
    }
    function Fo(e) {
        e.return !== null && (zt(e, 1), ja(e, 1, 0));
    }
    function jo(e) {
        for(; e === dl;)dl = on[--un], on[un] = null, pl = on[--un], on[un] = null;
        for(; e === Bt;)Bt = je[--ze], je[ze] = null, nt = je[--ze], je[ze] = null, tt = je[--ze], je[ze] = null;
    }
    var Ne = null, Ce = null, H = !1, We = null;
    function za(e, t) {
        var n = Ie(5, null, null, 0);
        n.elementType = "DELETED", n.stateNode = t, n.return = e, t = e.deletions, t === null ? (e.deletions = [
            n
        ], e.flags |= 16) : t.push(n);
    }
    function Uu(e, t) {
        switch(e.tag){
            case 5:
                var n = e.type;
                return t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t, t !== null ? (e.stateNode = t, Ne = e, Ce = kt(t.firstChild), !0) : !1;
            case 6:
                return t = e.pendingProps === "" || t.nodeType !== 3 ? null : t, t !== null ? (e.stateNode = t, Ne = e, Ce = null, !0) : !1;
            case 13:
                return t = t.nodeType !== 8 ? null : t, t !== null ? (n = Bt !== null ? {
                    id: tt,
                    overflow: nt
                } : null, e.memoizedState = {
                    dehydrated: t,
                    treeContext: n,
                    retryLane: 1073741824
                }, n = Ie(18, null, null, 0), n.stateNode = t, n.return = e, e.child = n, Ne = e, Ce = null, !0) : !1;
            default:
                return !1;
        }
    }
    function Hi(e) {
        return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
    }
    function Qi(e) {
        if (H) {
            var t = Ce;
            if (t) {
                var n = t;
                if (!Uu(e, t)) {
                    if (Hi(e)) throw Error(S(418));
                    t = kt(n.nextSibling);
                    var r = Ne;
                    t && Uu(e, t) ? za(r, n) : (e.flags = e.flags & -4097 | 2, H = !1, Ne = e);
                }
            } else {
                if (Hi(e)) throw Error(S(418));
                e.flags = e.flags & -4097 | 2, H = !1, Ne = e;
            }
        }
    }
    function Wu(e) {
        for(e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13;)e = e.return;
        Ne = e;
    }
    function Ir(e) {
        if (e !== Ne) return !1;
        if (!H) return Wu(e), H = !0, !1;
        var t;
        if ((t = e.tag !== 3) && !(t = e.tag !== 5) && (t = e.type, t = t !== "head" && t !== "body" && !Ui(e.type, e.memoizedProps)), t && (t = Ce)) {
            if (Hi(e)) throw Ia(), Error(S(418));
            for(; t;)za(e, t), t = kt(t.nextSibling);
        }
        if (Wu(e), e.tag === 13) {
            if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(S(317));
            e: {
                for(e = e.nextSibling, t = 0; e;){
                    if (e.nodeType === 8) {
                        var n = e.data;
                        if (n === "/$") {
                            if (t === 0) {
                                Ce = kt(e.nextSibling);
                                break e;
                            }
                            t--;
                        } else n !== "$" && n !== "$!" && n !== "$?" || t++;
                    }
                    e = e.nextSibling;
                }
                Ce = null;
            }
        } else Ce = Ne ? kt(e.stateNode.nextSibling) : null;
        return !0;
    }
    function Ia() {
        for(var e = Ce; e;)e = kt(e.nextSibling);
    }
    function wn() {
        Ce = Ne = null, H = !1;
    }
    function zo(e) {
        We === null ? We = [
            e
        ] : We.push(e);
    }
    var zd = st.ReactCurrentBatchConfig;
    function Mn(e, t, n) {
        if (e = n.ref, e !== null && typeof e != "function" && typeof e != "object") {
            if (n._owner) {
                if (n = n._owner, n) {
                    if (n.tag !== 1) throw Error(S(309));
                    var r = n.stateNode;
                }
                if (!r) throw Error(S(147, e));
                var l = r, i = "" + e;
                return t !== null && t.ref !== null && typeof t.ref == "function" && t.ref._stringRef === i ? t.ref : (t = function(o) {
                    var u = l.refs;
                    o === null ? delete u[i] : u[i] = o;
                }, t._stringRef = i, t);
            }
            if (typeof e != "string") throw Error(S(284));
            if (!n._owner) throw Error(S(290, e));
        }
        return e;
    }
    function Mr(e, t) {
        throw e = Object.prototype.toString.call(t), Error(S(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e));
    }
    function $u(e) {
        var t = e._init;
        return t(e._payload);
    }
    function Ma(e) {
        function t(f, c) {
            if (e) {
                var d = f.deletions;
                d === null ? (f.deletions = [
                    c
                ], f.flags |= 16) : d.push(c);
            }
        }
        function n(f, c) {
            if (!e) return null;
            for(; c !== null;)t(f, c), c = c.sibling;
            return null;
        }
        function r(f, c) {
            for(f = new Map; c !== null;)c.key !== null ? f.set(c.key, c) : f.set(c.index, c), c = c.sibling;
            return f;
        }
        function l(f, c) {
            return f = Ct(f, c), f.index = 0, f.sibling = null, f;
        }
        function i(f, c, d) {
            return f.index = d, e ? (d = f.alternate, d !== null ? (d = d.index, d < c ? (f.flags |= 2, c) : d) : (f.flags |= 2, c)) : (f.flags |= 1048576, c);
        }
        function o(f) {
            return e && f.alternate === null && (f.flags |= 2), f;
        }
        function u(f, c, d, w) {
            return c === null || c.tag !== 6 ? (c = fi(d, f.mode, w), c.return = f, c) : (c = l(c, d), c.return = f, c);
        }
        function s(f, c, d, w) {
            var _ = d.type;
            return _ === bt ? v(f, c, d.props.children, w, d.key) : c !== null && (c.elementType === _ || typeof _ == "object" && _ !== null && _.$$typeof === dt && $u(_) === c.type) ? (w = l(c, d.props), w.ref = Mn(f, c, d), w.return = f, w) : (w = br(d.type, d.key, d.props, null, f.mode, w), w.ref = Mn(f, c, d), w.return = f, w);
        }
        function a(f, c, d, w) {
            return c === null || c.tag !== 4 || c.stateNode.containerInfo !== d.containerInfo || c.stateNode.implementation !== d.implementation ? (c = di(d, f.mode, w), c.return = f, c) : (c = l(c, d.children || []), c.return = f, c);
        }
        function v(f, c, d, w, _) {
            return c === null || c.tag !== 7 ? (c = Wt(d, f.mode, w, _), c.return = f, c) : (c = l(c, d), c.return = f, c);
        }
        function m(f, c, d) {
            if (typeof c == "string" && c !== "" || typeof c == "number") return c = fi("" + c, f.mode, d), c.return = f, c;
            if (typeof c == "object" && c !== null) {
                switch(c.$$typeof){
                    case _r:
                        return d = br(c.type, c.key, c.props, null, f.mode, d), d.ref = Mn(f, null, c), d.return = f, d;
                    case Jt:
                        return c = di(c, f.mode, d), c.return = f, c;
                    case dt:
                        var w = c._init;
                        return m(f, w(c._payload), d);
                }
                if (Vn(c) || Ln(c)) return c = Wt(c, f.mode, d, null), c.return = f, c;
                Mr(f, c);
            }
            return null;
        }
        function p(f, c, d, w) {
            var _ = c !== null ? c.key : null;
            if (typeof d == "string" && d !== "" || typeof d == "number") return _ !== null ? null : u(f, c, "" + d, w);
            if (typeof d == "object" && d !== null) {
                switch(d.$$typeof){
                    case _r:
                        return d.key === _ ? s(f, c, d, w) : null;
                    case Jt:
                        return d.key === _ ? a(f, c, d, w) : null;
                    case dt:
                        return _ = d._init, p(f, c, _(d._payload), w);
                }
                if (Vn(d) || Ln(d)) return _ !== null ? null : v(f, c, d, w, null);
                Mr(f, d);
            }
            return null;
        }
        function g(f, c, d, w, _) {
            if (typeof w == "string" && w !== "" || typeof w == "number") return f = f.get(d) || null, u(c, f, "" + w, _);
            if (typeof w == "object" && w !== null) {
                switch(w.$$typeof){
                    case _r:
                        return f = f.get(w.key === null ? d : w.key) || null, s(c, f, w, _);
                    case Jt:
                        return f = f.get(w.key === null ? d : w.key) || null, a(c, f, w, _);
                    case dt:
                        var T = w._init;
                        return g(f, c, d, T(w._payload), _);
                }
                if (Vn(w) || Ln(w)) return f = f.get(d) || null, v(c, f, w, _, null);
                Mr(c, w);
            }
            return null;
        }
        function k(f, c, d, w) {
            for(var _ = null, T = null, P = c, R = c = 0, $ = null; P !== null && R < d.length; R++){
                P.index > R ? ($ = P, P = null) : $ = P.sibling;
                var z = p(f, P, d[R], w);
                if (z === null) {
                    P === null && (P = $);
                    break;
                }
                e && P && z.alternate === null && t(f, P), c = i(z, c, R), T === null ? _ = z : T.sibling = z, T = z, P = $;
            }
            if (R === d.length) return n(f, P), H && zt(f, R), _;
            if (P === null) {
                for(; R < d.length; R++)P = m(f, d[R], w), P !== null && (c = i(P, c, R), T === null ? _ = P : T.sibling = P, T = P);
                return H && zt(f, R), _;
            }
            for(P = r(f, P); R < d.length; R++)$ = g(P, f, R, d[R], w), $ !== null && (e && $.alternate !== null && P.delete($.key === null ? R : $.key), c = i($, c, R), T === null ? _ = $ : T.sibling = $, T = $);
            return e && P.forEach(function(b) {
                return t(f, b);
            }), H && zt(f, R), _;
        }
        function E(f, c, d, w) {
            var _ = Ln(d);
            if (typeof _ != "function") throw Error(S(150));
            if (d = _.call(d), d == null) throw Error(S(151));
            for(var T = _ = null, P = c, R = c = 0, $ = null, z = d.next(); P !== null && !z.done; R++, z = d.next()){
                P.index > R ? ($ = P, P = null) : $ = P.sibling;
                var b = p(f, P, z.value, w);
                if (b === null) {
                    P === null && (P = $);
                    break;
                }
                e && P && b.alternate === null && t(f, P), c = i(b, c, R), T === null ? _ = b : T.sibling = b, T = b, P = $;
            }
            if (z.done) return n(f, P), H && zt(f, R), _;
            if (P === null) {
                for(; !z.done; R++, z = d.next())z = m(f, z.value, w), z !== null && (c = i(z, c, R), T === null ? _ = z : T.sibling = z, T = z);
                return H && zt(f, R), _;
            }
            for(P = r(f, P); !z.done; R++, z = d.next())z = g(P, f, R, z.value, w), z !== null && (e && z.alternate !== null && P.delete(z.key === null ? R : z.key), c = i(z, c, R), T === null ? _ = z : T.sibling = z, T = z);
            return e && P.forEach(function(at) {
                return t(f, at);
            }), H && zt(f, R), _;
        }
        function O(f, c, d, w) {
            if (typeof d == "object" && d !== null && d.type === bt && d.key === null && (d = d.props.children), typeof d == "object" && d !== null) {
                switch(d.$$typeof){
                    case _r:
                        e: {
                            for(var _ = d.key, T = c; T !== null;){
                                if (T.key === _) {
                                    if (_ = d.type, _ === bt) {
                                        if (T.tag === 7) {
                                            n(f, T.sibling), c = l(T, d.props.children), c.return = f, f = c;
                                            break e;
                                        }
                                    } else if (T.elementType === _ || typeof _ == "object" && _ !== null && _.$$typeof === dt && $u(_) === T.type) {
                                        n(f, T.sibling), c = l(T, d.props), c.ref = Mn(f, T, d), c.return = f, f = c;
                                        break e;
                                    }
                                    n(f, T);
                                    break;
                                } else t(f, T);
                                T = T.sibling;
                            }
                            d.type === bt ? (c = Wt(d.props.children, f.mode, w, d.key), c.return = f, f = c) : (w = br(d.type, d.key, d.props, null, f.mode, w), w.ref = Mn(f, c, d), w.return = f, f = w);
                        }
                        return o(f);
                    case Jt:
                        e: {
                            for(T = d.key; c !== null;){
                                if (c.key === T) if (c.tag === 4 && c.stateNode.containerInfo === d.containerInfo && c.stateNode.implementation === d.implementation) {
                                    n(f, c.sibling), c = l(c, d.children || []), c.return = f, f = c;
                                    break e;
                                } else {
                                    n(f, c);
                                    break;
                                }
                                else t(f, c);
                                c = c.sibling;
                            }
                            c = di(d, f.mode, w), c.return = f, f = c;
                        }
                        return o(f);
                    case dt:
                        return T = d._init, O(f, c, T(d._payload), w);
                }
                if (Vn(d)) return k(f, c, d, w);
                if (Ln(d)) return E(f, c, d, w);
                Mr(f, d);
            }
            return typeof d == "string" && d !== "" || typeof d == "number" ? (d = "" + d, c !== null && c.tag === 6 ? (n(f, c.sibling), c = l(c, d), c.return = f, f = c) : (n(f, c), c = fi(d, f.mode, w), c.return = f, f = c), o(f)) : n(f, c);
        }
        return O;
    }
    var Sn = Ma(!0), Oa = Ma(!1), hl = Rt(null), ml = null, sn = null, Io = null;
    function Mo() {
        Io = sn = ml = null;
    }
    function Oo(e) {
        var t = hl.current;
        W(hl), e._currentValue = t;
    }
    function Gi(e, t, n) {
        for(; e !== null;){
            var r = e.alternate;
            if ((e.childLanes & t) !== t ? (e.childLanes |= t, r !== null && (r.childLanes |= t)) : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t), e === n) break;
            e = e.return;
        }
    }
    function mn(e, t) {
        ml = e, Io = sn = null, e = e.dependencies, e !== null && e.firstContext !== null && (e.lanes & t && (Se = !0), e.firstContext = null);
    }
    function Oe(e) {
        var t = e._currentValue;
        if (Io !== e) if (e = {
            context: e,
            memoizedValue: t,
            next: null
        }, sn === null) {
            if (ml === null) throw Error(S(308));
            sn = e, ml.dependencies = {
                lanes: 0,
                firstContext: e
            };
        } else sn = sn.next = e;
        return t;
    }
    var At = null;
    function Do(e) {
        At === null ? At = [
            e
        ] : At.push(e);
    }
    function Da(e, t, n, r) {
        var l = t.interleaved;
        return l === null ? (n.next = n, Do(t)) : (n.next = l.next, l.next = n), t.interleaved = n, ot(e, r);
    }
    function ot(e, t) {
        e.lanes |= t;
        var n = e.alternate;
        for(n !== null && (n.lanes |= t), n = e, e = e.return; e !== null;)e.childLanes |= t, n = e.alternate, n !== null && (n.childLanes |= t), n = e, e = e.return;
        return n.tag === 3 ? n.stateNode : null;
    }
    var pt = !1;
    function Ao(e) {
        e.updateQueue = {
            baseState: e.memoizedState,
            firstBaseUpdate: null,
            lastBaseUpdate: null,
            shared: {
                pending: null,
                interleaved: null,
                lanes: 0
            },
            effects: null
        };
    }
    function Aa(e, t) {
        e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
            baseState: e.baseState,
            firstBaseUpdate: e.firstBaseUpdate,
            lastBaseUpdate: e.lastBaseUpdate,
            shared: e.shared,
            effects: e.effects
        });
    }
    function rt(e, t) {
        return {
            eventTime: e,
            lane: t,
            tag: 0,
            payload: null,
            callback: null,
            next: null
        };
    }
    function xt(e, t, n) {
        var r = e.updateQueue;
        if (r === null) return null;
        if (r = r.shared, D & 2) {
            var l = r.pending;
            return l === null ? t.next = t : (t.next = l.next, l.next = t), r.pending = t, ot(e, n);
        }
        return l = r.interleaved, l === null ? (t.next = t, Do(r)) : (t.next = l.next, l.next = t), r.interleaved = t, ot(e, n);
    }
    function Kr(e, t, n) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194240) !== 0)) {
            var r = t.lanes;
            r &= e.pendingLanes, n |= r, t.lanes = n, Eo(e, n);
        }
    }
    function Bu(e, t) {
        var n = e.updateQueue, r = e.alternate;
        if (r !== null && (r = r.updateQueue, n === r)) {
            var l = null, i = null;
            if (n = n.firstBaseUpdate, n !== null) {
                do {
                    var o = {
                        eventTime: n.eventTime,
                        lane: n.lane,
                        tag: n.tag,
                        payload: n.payload,
                        callback: n.callback,
                        next: null
                    };
                    i === null ? l = i = o : i = i.next = o, n = n.next;
                }while (n !== null);
                i === null ? l = i = t : i = i.next = t;
            } else l = i = t;
            n = {
                baseState: r.baseState,
                firstBaseUpdate: l,
                lastBaseUpdate: i,
                shared: r.shared,
                effects: r.effects
            }, e.updateQueue = n;
            return;
        }
        e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
    }
    function vl(e, t, n, r) {
        var l = e.updateQueue;
        pt = !1;
        var i = l.firstBaseUpdate, o = l.lastBaseUpdate, u = l.shared.pending;
        if (u !== null) {
            l.shared.pending = null;
            var s = u, a = s.next;
            s.next = null, o === null ? i = a : o.next = a, o = s;
            var v = e.alternate;
            v !== null && (v = v.updateQueue, u = v.lastBaseUpdate, u !== o && (u === null ? v.firstBaseUpdate = a : u.next = a, v.lastBaseUpdate = s));
        }
        if (i !== null) {
            var m = l.baseState;
            o = 0, v = a = s = null, u = i;
            do {
                var p = u.lane, g = u.eventTime;
                if ((r & p) === p) {
                    v !== null && (v = v.next = {
                        eventTime: g,
                        lane: 0,
                        tag: u.tag,
                        payload: u.payload,
                        callback: u.callback,
                        next: null
                    });
                    e: {
                        var k = e, E = u;
                        switch(p = t, g = n, E.tag){
                            case 1:
                                if (k = E.payload, typeof k == "function") {
                                    m = k.call(g, m, p);
                                    break e;
                                }
                                m = k;
                                break e;
                            case 3:
                                k.flags = k.flags & -65537 | 128;
                            case 0:
                                if (k = E.payload, p = typeof k == "function" ? k.call(g, m, p) : k, p == null) break e;
                                m = K({}, m, p);
                                break e;
                            case 2:
                                pt = !0;
                        }
                    }
                    u.callback !== null && u.lane !== 0 && (e.flags |= 64, p = l.effects, p === null ? l.effects = [
                        u
                    ] : p.push(u));
                } else g = {
                    eventTime: g,
                    lane: p,
                    tag: u.tag,
                    payload: u.payload,
                    callback: u.callback,
                    next: null
                }, v === null ? (a = v = g, s = m) : v = v.next = g, o |= p;
                if (u = u.next, u === null) {
                    if (u = l.shared.pending, u === null) break;
                    p = u, u = p.next, p.next = null, l.lastBaseUpdate = p, l.shared.pending = null;
                }
            }while (!0);
            if (v === null && (s = m), l.baseState = s, l.firstBaseUpdate = a, l.lastBaseUpdate = v, t = l.shared.interleaved, t !== null) {
                l = t;
                do o |= l.lane, l = l.next;
                while (l !== t);
            } else i === null && (l.shared.lanes = 0);
            Qt |= o, e.lanes = o, e.memoizedState = m;
        }
    }
    function Hu(e, t, n) {
        if (e = t.effects, t.effects = null, e !== null) for(t = 0; t < e.length; t++){
            var r = e[t], l = r.callback;
            if (l !== null) {
                if (r.callback = null, r = n, typeof l != "function") throw Error(S(191, l));
                l.call(r);
            }
        }
    }
    var xr = {}, Xe = Rt(xr), fr = Rt(xr), dr = Rt(xr);
    function Vt(e) {
        if (e === xr) throw Error(S(174));
        return e;
    }
    function Vo(e, t) {
        switch(V(dr, t), V(fr, e), V(Xe, xr), e = t.nodeType, e){
            case 9:
            case 11:
                t = (t = t.documentElement) ? t.namespaceURI : Ni(null, "");
                break;
            default:
                e = e === 8 ? t.parentNode : t, t = e.namespaceURI || null, e = e.tagName, t = Ni(t, e);
        }
        W(Xe), V(Xe, t);
    }
    function kn() {
        W(Xe), W(fr), W(dr);
    }
    function Va(e) {
        Vt(dr.current);
        var t = Vt(Xe.current), n = Ni(t, e.type);
        t !== n && (V(fr, e), V(Xe, n));
    }
    function Uo(e) {
        fr.current === e && (W(Xe), W(fr));
    }
    var Q = Rt(0);
    function yl(e) {
        for(var t = e; t !== null;){
            if (t.tag === 13) {
                var n = t.memoizedState;
                if (n !== null && (n = n.dehydrated, n === null || n.data === "$?" || n.data === "$!")) return t;
            } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
                if (t.flags & 128) return t;
            } else if (t.child !== null) {
                t.child.return = t, t = t.child;
                continue;
            }
            if (t === e) break;
            for(; t.sibling === null;){
                if (t.return === null || t.return === e) return null;
                t = t.return;
            }
            t.sibling.return = t.return, t = t.sibling;
        }
        return null;
    }
    var ii = [];
    function Wo() {
        for(var e = 0; e < ii.length; e++)ii[e]._workInProgressVersionPrimary = null;
        ii.length = 0;
    }
    var Yr = st.ReactCurrentDispatcher, oi = st.ReactCurrentBatchConfig, Ht = 0, G = null, ee = null, le = null, gl = !1, Xn = !1, pr = 0, Id = 0;
    function ae() {
        throw Error(S(321));
    }
    function $o(e, t) {
        if (t === null) return !1;
        for(var n = 0; n < t.length && n < e.length; n++)if (!He(e[n], t[n])) return !1;
        return !0;
    }
    function Bo(e, t, n, r, l, i) {
        if (Ht = i, G = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, Yr.current = e === null || e.memoizedState === null ? Ad : Vd, e = n(r, l), Xn) {
            i = 0;
            do {
                if (Xn = !1, pr = 0, 25 <= i) throw Error(S(301));
                i += 1, le = ee = null, t.updateQueue = null, Yr.current = Ud, e = n(r, l);
            }while (Xn);
        }
        if (Yr.current = wl, t = ee !== null && ee.next !== null, Ht = 0, le = ee = G = null, gl = !1, t) throw Error(S(300));
        return e;
    }
    function Ho() {
        var e = pr !== 0;
        return pr = 0, e;
    }
    function Ge() {
        var e = {
            memoizedState: null,
            baseState: null,
            baseQueue: null,
            queue: null,
            next: null
        };
        return le === null ? G.memoizedState = le = e : le = le.next = e, le;
    }
    function De() {
        if (ee === null) {
            var e = G.alternate;
            e = e !== null ? e.memoizedState : null;
        } else e = ee.next;
        var t = le === null ? G.memoizedState : le.next;
        if (t !== null) le = t, ee = e;
        else {
            if (e === null) throw Error(S(310));
            ee = e, e = {
                memoizedState: ee.memoizedState,
                baseState: ee.baseState,
                baseQueue: ee.baseQueue,
                queue: ee.queue,
                next: null
            }, le === null ? G.memoizedState = le = e : le = le.next = e;
        }
        return le;
    }
    function hr(e, t) {
        return typeof t == "function" ? t(e) : t;
    }
    function ui(e) {
        var t = De(), n = t.queue;
        if (n === null) throw Error(S(311));
        n.lastRenderedReducer = e;
        var r = ee, l = r.baseQueue, i = n.pending;
        if (i !== null) {
            if (l !== null) {
                var o = l.next;
                l.next = i.next, i.next = o;
            }
            r.baseQueue = l = i, n.pending = null;
        }
        if (l !== null) {
            i = l.next, r = r.baseState;
            var u = o = null, s = null, a = i;
            do {
                var v = a.lane;
                if ((Ht & v) === v) s !== null && (s = s.next = {
                    lane: 0,
                    action: a.action,
                    hasEagerState: a.hasEagerState,
                    eagerState: a.eagerState,
                    next: null
                }), r = a.hasEagerState ? a.eagerState : e(r, a.action);
                else {
                    var m = {
                        lane: v,
                        action: a.action,
                        hasEagerState: a.hasEagerState,
                        eagerState: a.eagerState,
                        next: null
                    };
                    s === null ? (u = s = m, o = r) : s = s.next = m, G.lanes |= v, Qt |= v;
                }
                a = a.next;
            }while (a !== null && a !== i);
            s === null ? o = r : s.next = u, He(r, t.memoizedState) || (Se = !0), t.memoizedState = r, t.baseState = o, t.baseQueue = s, n.lastRenderedState = r;
        }
        if (e = n.interleaved, e !== null) {
            l = e;
            do i = l.lane, G.lanes |= i, Qt |= i, l = l.next;
            while (l !== e);
        } else l === null && (n.lanes = 0);
        return [
            t.memoizedState,
            n.dispatch
        ];
    }
    function si(e) {
        var t = De(), n = t.queue;
        if (n === null) throw Error(S(311));
        n.lastRenderedReducer = e;
        var r = n.dispatch, l = n.pending, i = t.memoizedState;
        if (l !== null) {
            n.pending = null;
            var o = l = l.next;
            do i = e(i, o.action), o = o.next;
            while (o !== l);
            He(i, t.memoizedState) || (Se = !0), t.memoizedState = i, t.baseQueue === null && (t.baseState = i), n.lastRenderedState = i;
        }
        return [
            i,
            r
        ];
    }
    function Ua() {}
    function Wa(e, t) {
        var n = G, r = De(), l = t(), i = !He(r.memoizedState, l);
        if (i && (r.memoizedState = l, Se = !0), r = r.queue, Qo(Ha.bind(null, n, r, e), [
            e
        ]), r.getSnapshot !== t || i || le !== null && le.memoizedState.tag & 1) {
            if (n.flags |= 2048, mr(9, Ba.bind(null, n, r, l, t), void 0, null), ie === null) throw Error(S(349));
            Ht & 30 || $a(n, t, l);
        }
        return l;
    }
    function $a(e, t, n) {
        e.flags |= 16384, e = {
            getSnapshot: t,
            value: n
        }, t = G.updateQueue, t === null ? (t = {
            lastEffect: null,
            stores: null
        }, G.updateQueue = t, t.stores = [
            e
        ]) : (n = t.stores, n === null ? t.stores = [
            e
        ] : n.push(e));
    }
    function Ba(e, t, n, r) {
        t.value = n, t.getSnapshot = r, Qa(t) && Ga(e);
    }
    function Ha(e, t, n) {
        return n(function() {
            Qa(t) && Ga(e);
        });
    }
    function Qa(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
            var n = t();
            return !He(e, n);
        } catch  {
            return !0;
        }
    }
    function Ga(e) {
        var t = ot(e, 1);
        t !== null && Be(t, e, 1, -1);
    }
    function Qu(e) {
        var t = Ge();
        return typeof e == "function" && (e = e()), t.memoizedState = t.baseState = e, e = {
            pending: null,
            interleaved: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: hr,
            lastRenderedState: e
        }, t.queue = e, e = e.dispatch = Dd.bind(null, G, e), [
            t.memoizedState,
            e
        ];
    }
    function mr(e, t, n, r) {
        return e = {
            tag: e,
            create: t,
            destroy: n,
            deps: r,
            next: null
        }, t = G.updateQueue, t === null ? (t = {
            lastEffect: null,
            stores: null
        }, G.updateQueue = t, t.lastEffect = e.next = e) : (n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e)), e;
    }
    function Ka() {
        return De().memoizedState;
    }
    function Xr(e, t, n, r) {
        var l = Ge();
        G.flags |= e, l.memoizedState = mr(1 | t, n, void 0, r === void 0 ? null : r);
    }
    function jl(e, t, n, r) {
        var l = De();
        r = r === void 0 ? null : r;
        var i = void 0;
        if (ee !== null) {
            var o = ee.memoizedState;
            if (i = o.destroy, r !== null && $o(r, o.deps)) {
                l.memoizedState = mr(t, n, i, r);
                return;
            }
        }
        G.flags |= e, l.memoizedState = mr(1 | t, n, i, r);
    }
    function Gu(e, t) {
        return Xr(8390656, 8, e, t);
    }
    function Qo(e, t) {
        return jl(2048, 8, e, t);
    }
    function Ya(e, t) {
        return jl(4, 2, e, t);
    }
    function Xa(e, t) {
        return jl(4, 4, e, t);
    }
    function qa(e, t) {
        if (typeof t == "function") return e = e(), t(e), function() {
            t(null);
        };
        if (t != null) return e = e(), t.current = e, function() {
            t.current = null;
        };
    }
    function Za(e, t, n) {
        return n = n != null ? n.concat([
            e
        ]) : null, jl(4, 4, qa.bind(null, t, e), n);
    }
    function Go() {}
    function Ja(e, t) {
        var n = De();
        t = t === void 0 ? null : t;
        var r = n.memoizedState;
        return r !== null && t !== null && $o(t, r[1]) ? r[0] : (n.memoizedState = [
            e,
            t
        ], e);
    }
    function ba(e, t) {
        var n = De();
        t = t === void 0 ? null : t;
        var r = n.memoizedState;
        return r !== null && t !== null && $o(t, r[1]) ? r[0] : (e = e(), n.memoizedState = [
            e,
            t
        ], e);
    }
    function ec(e, t, n) {
        return Ht & 21 ? (He(n, t) || (n = ia(), G.lanes |= n, Qt |= n, e.baseState = !0), t) : (e.baseState && (e.baseState = !1, Se = !0), e.memoizedState = n);
    }
    function Md(e, t) {
        var n = A;
        A = n !== 0 && 4 > n ? n : 4, e(!0);
        var r = oi.transition;
        oi.transition = {};
        try {
            e(!1), t();
        } finally{
            A = n, oi.transition = r;
        }
    }
    function tc() {
        return De().memoizedState;
    }
    function Od(e, t, n) {
        var r = _t(e);
        if (n = {
            lane: r,
            action: n,
            hasEagerState: !1,
            eagerState: null,
            next: null
        }, nc(e)) rc(t, n);
        else if (n = Da(e, t, n, r), n !== null) {
            var l = me();
            Be(n, e, r, l), lc(n, t, r);
        }
    }
    function Dd(e, t, n) {
        var r = _t(e), l = {
            lane: r,
            action: n,
            hasEagerState: !1,
            eagerState: null,
            next: null
        };
        if (nc(e)) rc(t, l);
        else {
            var i = e.alternate;
            if (e.lanes === 0 && (i === null || i.lanes === 0) && (i = t.lastRenderedReducer, i !== null)) try {
                var o = t.lastRenderedState, u = i(o, n);
                if (l.hasEagerState = !0, l.eagerState = u, He(u, o)) {
                    var s = t.interleaved;
                    s === null ? (l.next = l, Do(t)) : (l.next = s.next, s.next = l), t.interleaved = l;
                    return;
                }
            } catch  {} finally{}
            n = Da(e, t, l, r), n !== null && (l = me(), Be(n, e, r, l), lc(n, t, r));
        }
    }
    function nc(e) {
        var t = e.alternate;
        return e === G || t !== null && t === G;
    }
    function rc(e, t) {
        Xn = gl = !0;
        var n = e.pending;
        n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
    }
    function lc(e, t, n) {
        if (n & 4194240) {
            var r = t.lanes;
            r &= e.pendingLanes, n |= r, t.lanes = n, Eo(e, n);
        }
    }
    var wl = {
        readContext: Oe,
        useCallback: ae,
        useContext: ae,
        useEffect: ae,
        useImperativeHandle: ae,
        useInsertionEffect: ae,
        useLayoutEffect: ae,
        useMemo: ae,
        useReducer: ae,
        useRef: ae,
        useState: ae,
        useDebugValue: ae,
        useDeferredValue: ae,
        useTransition: ae,
        useMutableSource: ae,
        useSyncExternalStore: ae,
        useId: ae,
        unstable_isNewReconciler: !1
    }, Ad = {
        readContext: Oe,
        useCallback: function(e, t) {
            return Ge().memoizedState = [
                e,
                t === void 0 ? null : t
            ], e;
        },
        useContext: Oe,
        useEffect: Gu,
        useImperativeHandle: function(e, t, n) {
            return n = n != null ? n.concat([
                e
            ]) : null, Xr(4194308, 4, qa.bind(null, t, e), n);
        },
        useLayoutEffect: function(e, t) {
            return Xr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
            return Xr(4, 2, e, t);
        },
        useMemo: function(e, t) {
            var n = Ge();
            return t = t === void 0 ? null : t, e = e(), n.memoizedState = [
                e,
                t
            ], e;
        },
        useReducer: function(e, t, n) {
            var r = Ge();
            return t = n !== void 0 ? n(t) : t, r.memoizedState = r.baseState = t, e = {
                pending: null,
                interleaved: null,
                lanes: 0,
                dispatch: null,
                lastRenderedReducer: e,
                lastRenderedState: t
            }, r.queue = e, e = e.dispatch = Od.bind(null, G, e), [
                r.memoizedState,
                e
            ];
        },
        useRef: function(e) {
            var t = Ge();
            return e = {
                current: e
            }, t.memoizedState = e;
        },
        useState: Qu,
        useDebugValue: Go,
        useDeferredValue: function(e) {
            return Ge().memoizedState = e;
        },
        useTransition: function() {
            var e = Qu(!1), t = e[0];
            return e = Md.bind(null, e[1]), Ge().memoizedState = e, [
                t,
                e
            ];
        },
        useMutableSource: function() {},
        useSyncExternalStore: function(e, t, n) {
            var r = G, l = Ge();
            if (H) {
                if (n === void 0) throw Error(S(407));
                n = n();
            } else {
                if (n = t(), ie === null) throw Error(S(349));
                Ht & 30 || $a(r, t, n);
            }
            l.memoizedState = n;
            var i = {
                value: n,
                getSnapshot: t
            };
            return l.queue = i, Gu(Ha.bind(null, r, i, e), [
                e
            ]), r.flags |= 2048, mr(9, Ba.bind(null, r, i, n, t), void 0, null), n;
        },
        useId: function() {
            var e = Ge(), t = ie.identifierPrefix;
            if (H) {
                var n = nt, r = tt;
                n = (r & ~(1 << 32 - $e(r) - 1)).toString(32) + n, t = ":" + t + "R" + n, n = pr++, 0 < n && (t += "H" + n.toString(32)), t += ":";
            } else n = Id++, t = ":" + t + "r" + n.toString(32) + ":";
            return e.memoizedState = t;
        },
        unstable_isNewReconciler: !1
    }, Vd = {
        readContext: Oe,
        useCallback: Ja,
        useContext: Oe,
        useEffect: Qo,
        useImperativeHandle: Za,
        useInsertionEffect: Ya,
        useLayoutEffect: Xa,
        useMemo: ba,
        useReducer: ui,
        useRef: Ka,
        useState: function() {
            return ui(hr);
        },
        useDebugValue: Go,
        useDeferredValue: function(e) {
            var t = De();
            return ec(t, ee.memoizedState, e);
        },
        useTransition: function() {
            var e = ui(hr)[0], t = De().memoizedState;
            return [
                e,
                t
            ];
        },
        useMutableSource: Ua,
        useSyncExternalStore: Wa,
        useId: tc,
        unstable_isNewReconciler: !1
    }, Ud = {
        readContext: Oe,
        useCallback: Ja,
        useContext: Oe,
        useEffect: Qo,
        useImperativeHandle: Za,
        useInsertionEffect: Ya,
        useLayoutEffect: Xa,
        useMemo: ba,
        useReducer: si,
        useRef: Ka,
        useState: function() {
            return si(hr);
        },
        useDebugValue: Go,
        useDeferredValue: function(e) {
            var t = De();
            return ee === null ? t.memoizedState = e : ec(t, ee.memoizedState, e);
        },
        useTransition: function() {
            var e = si(hr)[0], t = De().memoizedState;
            return [
                e,
                t
            ];
        },
        useMutableSource: Ua,
        useSyncExternalStore: Wa,
        useId: tc,
        unstable_isNewReconciler: !1
    };
    function Ve(e, t) {
        if (e && e.defaultProps) {
            t = K({}, t), e = e.defaultProps;
            for(var n in e)t[n] === void 0 && (t[n] = e[n]);
            return t;
        }
        return t;
    }
    function Ki(e, t, n, r) {
        t = e.memoizedState, n = n(r, t), n = n == null ? t : K({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
    }
    var zl = {
        isMounted: function(e) {
            return (e = e._reactInternals) ? Yt(e) === e : !1;
        },
        enqueueSetState: function(e, t, n) {
            e = e._reactInternals;
            var r = me(), l = _t(e), i = rt(r, l);
            i.payload = t, n != null && (i.callback = n), t = xt(e, i, l), t !== null && (Be(t, e, l, r), Kr(t, e, l));
        },
        enqueueReplaceState: function(e, t, n) {
            e = e._reactInternals;
            var r = me(), l = _t(e), i = rt(r, l);
            i.tag = 1, i.payload = t, n != null && (i.callback = n), t = xt(e, i, l), t !== null && (Be(t, e, l, r), Kr(t, e, l));
        },
        enqueueForceUpdate: function(e, t) {
            e = e._reactInternals;
            var n = me(), r = _t(e), l = rt(n, r);
            l.tag = 2, t != null && (l.callback = t), t = xt(e, l, r), t !== null && (Be(t, e, r, n), Kr(t, e, r));
        }
    };
    function Ku(e, t, n, r, l, i, o) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, i, o) : t.prototype && t.prototype.isPureReactComponent ? !ur(n, r) || !ur(l, i) : !0;
    }
    function ic(e, t, n) {
        var r = !1, l = Tt, i = t.contextType;
        return typeof i == "object" && i !== null ? i = Oe(i) : (l = xe(t) ? $t : de.current, r = t.contextTypes, i = (r = r != null) ? gn(e, l) : Tt), t = new t(n, i), e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null, t.updater = zl, e.stateNode = t, t._reactInternals = e, r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = l, e.__reactInternalMemoizedMaskedChildContext = i), t;
    }
    function Yu(e, t, n, r) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && zl.enqueueReplaceState(t, t.state, null);
    }
    function Yi(e, t, n, r) {
        var l = e.stateNode;
        l.props = n, l.state = e.memoizedState, l.refs = {}, Ao(e);
        var i = t.contextType;
        typeof i == "object" && i !== null ? l.context = Oe(i) : (i = xe(t) ? $t : de.current, l.context = gn(e, i)), l.state = e.memoizedState, i = t.getDerivedStateFromProps, typeof i == "function" && (Ki(e, t, i, n), l.state = e.memoizedState), typeof t.getDerivedStateFromProps == "function" || typeof l.getSnapshotBeforeUpdate == "function" || typeof l.UNSAFE_componentWillMount != "function" && typeof l.componentWillMount != "function" || (t = l.state, typeof l.componentWillMount == "function" && l.componentWillMount(), typeof l.UNSAFE_componentWillMount == "function" && l.UNSAFE_componentWillMount(), t !== l.state && zl.enqueueReplaceState(l, l.state, null), vl(e, n, l, r), l.state = e.memoizedState), typeof l.componentDidMount == "function" && (e.flags |= 4194308);
    }
    function xn(e, t) {
        try {
            var n = "", r = t;
            do n += hf(r), r = r.return;
            while (r);
            var l = n;
        } catch (i) {
            l = `
Error generating stack: ` + i.message + `
` + i.stack;
        }
        return {
            value: e,
            source: t,
            stack: l,
            digest: null
        };
    }
    function ai(e, t, n) {
        return {
            value: e,
            source: null,
            stack: n ?? null,
            digest: t ?? null
        };
    }
    function Xi(e, t) {
        try {
            console.error(t.value);
        } catch (n) {
            setTimeout(function() {
                throw n;
            });
        }
    }
    var Wd = typeof WeakMap == "function" ? WeakMap : Map;
    function oc(e, t, n) {
        n = rt(-1, n), n.tag = 3, n.payload = {
            element: null
        };
        var r = t.value;
        return n.callback = function() {
            kl || (kl = !0, io = r), Xi(e, t);
        }, n;
    }
    function uc(e, t, n) {
        n = rt(-1, n), n.tag = 3;
        var r = e.type.getDerivedStateFromError;
        if (typeof r == "function") {
            var l = t.value;
            n.payload = function() {
                return r(l);
            }, n.callback = function() {
                Xi(e, t);
            };
        }
        var i = e.stateNode;
        return i !== null && typeof i.componentDidCatch == "function" && (n.callback = function() {
            Xi(e, t), typeof r != "function" && (Et === null ? Et = new Set([
                this
            ]) : Et.add(this));
            var o = t.stack;
            this.componentDidCatch(t.value, {
                componentStack: o !== null ? o : ""
            });
        }), n;
    }
    function Xu(e, t, n) {
        var r = e.pingCache;
        if (r === null) {
            r = e.pingCache = new Wd;
            var l = new Set;
            r.set(t, l);
        } else l = r.get(t), l === void 0 && (l = new Set, r.set(t, l));
        l.has(n) || (l.add(n), e = tp.bind(null, e, t, n), t.then(e, e));
    }
    function qu(e) {
        do {
            var t;
            if ((t = e.tag === 13) && (t = e.memoizedState, t = t !== null ? t.dehydrated !== null : !0), t) return e;
            e = e.return;
        }while (e !== null);
        return null;
    }
    function Zu(e, t, n, r, l) {
        return e.mode & 1 ? (e.flags |= 65536, e.lanes = l, e) : (e === t ? e.flags |= 65536 : (e.flags |= 128, n.flags |= 131072, n.flags &= -52805, n.tag === 1 && (n.alternate === null ? n.tag = 17 : (t = rt(-1, 1), t.tag = 2, xt(n, t, 1))), n.lanes |= 1), e);
    }
    var $d = st.ReactCurrentOwner, Se = !1;
    function he(e, t, n, r) {
        t.child = e === null ? Oa(t, null, n, r) : Sn(t, e.child, n, r);
    }
    function Ju(e, t, n, r, l) {
        n = n.render;
        var i = t.ref;
        return mn(t, l), r = Bo(e, t, n, r, i, l), n = Ho(), e !== null && !Se ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, ut(e, t, l)) : (H && n && Fo(t), t.flags |= 1, he(e, t, r, l), t.child);
    }
    function bu(e, t, n, r, l) {
        if (e === null) {
            var i = n.type;
            return typeof i == "function" && !eu(i) && i.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0 ? (t.tag = 15, t.type = i, sc(e, t, i, r, l)) : (e = br(n.type, null, r, t, t.mode, l), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (i = e.child, !(e.lanes & l)) {
            var o = i.memoizedProps;
            if (n = n.compare, n = n !== null ? n : ur, n(o, r) && e.ref === t.ref) return ut(e, t, l);
        }
        return t.flags |= 1, e = Ct(i, r), e.ref = t.ref, e.return = t, t.child = e;
    }
    function sc(e, t, n, r, l) {
        if (e !== null) {
            var i = e.memoizedProps;
            if (ur(i, r) && e.ref === t.ref) if (Se = !1, t.pendingProps = r = i, (e.lanes & l) !== 0) e.flags & 131072 && (Se = !0);
            else return t.lanes = e.lanes, ut(e, t, l);
        }
        return qi(e, t, n, r, l);
    }
    function ac(e, t, n) {
        var r = t.pendingProps, l = r.children, i = e !== null ? e.memoizedState : null;
        if (r.mode === "hidden") if (!(t.mode & 1)) t.memoizedState = {
            baseLanes: 0,
            cachePool: null,
            transitions: null
        }, V(cn, _e), _e |= n;
        else {
            if (!(n & 1073741824)) return e = i !== null ? i.baseLanes | n : n, t.lanes = t.childLanes = 1073741824, t.memoizedState = {
                baseLanes: e,
                cachePool: null,
                transitions: null
            }, t.updateQueue = null, V(cn, _e), _e |= e, null;
            t.memoizedState = {
                baseLanes: 0,
                cachePool: null,
                transitions: null
            }, r = i !== null ? i.baseLanes : n, V(cn, _e), _e |= r;
        }
        else i !== null ? (r = i.baseLanes | n, t.memoizedState = null) : r = n, V(cn, _e), _e |= r;
        return he(e, t, l, n), t.child;
    }
    function cc(e, t) {
        var n = t.ref;
        (e === null && n !== null || e !== null && e.ref !== n) && (t.flags |= 512, t.flags |= 2097152);
    }
    function qi(e, t, n, r, l) {
        var i = xe(n) ? $t : de.current;
        return i = gn(t, i), mn(t, l), n = Bo(e, t, n, r, i, l), r = Ho(), e !== null && !Se ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, ut(e, t, l)) : (H && r && Fo(t), t.flags |= 1, he(e, t, n, l), t.child);
    }
    function es(e, t, n, r, l) {
        if (xe(n)) {
            var i = !0;
            fl(t);
        } else i = !1;
        if (mn(t, l), t.stateNode === null) qr(e, t), ic(t, n, r), Yi(t, n, r, l), r = !0;
        else if (e === null) {
            var o = t.stateNode, u = t.memoizedProps;
            o.props = u;
            var s = o.context, a = n.contextType;
            typeof a == "object" && a !== null ? a = Oe(a) : (a = xe(n) ? $t : de.current, a = gn(t, a));
            var v = n.getDerivedStateFromProps, m = typeof v == "function" || typeof o.getSnapshotBeforeUpdate == "function";
            m || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (u !== r || s !== a) && Yu(t, o, r, a), pt = !1;
            var p = t.memoizedState;
            o.state = p, vl(t, r, o, l), s = t.memoizedState, u !== r || p !== s || ke.current || pt ? (typeof v == "function" && (Ki(t, n, v, r), s = t.memoizedState), (u = pt || Ku(t, n, u, r, p, s, a)) ? (m || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = s), o.props = r, o.state = s, o.context = a, r = u) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
        } else {
            o = t.stateNode, Aa(e, t), u = t.memoizedProps, a = t.type === t.elementType ? u : Ve(t.type, u), o.props = a, m = t.pendingProps, p = o.context, s = n.contextType, typeof s == "object" && s !== null ? s = Oe(s) : (s = xe(n) ? $t : de.current, s = gn(t, s));
            var g = n.getDerivedStateFromProps;
            (v = typeof g == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (u !== m || p !== s) && Yu(t, o, r, s), pt = !1, p = t.memoizedState, o.state = p, vl(t, r, o, l);
            var k = t.memoizedState;
            u !== m || p !== k || ke.current || pt ? (typeof g == "function" && (Ki(t, n, g, r), k = t.memoizedState), (a = pt || Ku(t, n, a, r, p, k, s) || !1) ? (v || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(r, k, s), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(r, k, s)), typeof o.componentDidUpdate == "function" && (t.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = k), o.props = r, o.state = k, o.context = s, r = a) : (typeof o.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), r = !1);
        }
        return Zi(e, t, n, r, i, l);
    }
    function Zi(e, t, n, r, l, i) {
        cc(e, t);
        var o = (t.flags & 128) !== 0;
        if (!r && !o) return l && Vu(t, n, !1), ut(e, t, i);
        r = t.stateNode, $d.current = t;
        var u = o && typeof n.getDerivedStateFromError != "function" ? null : r.render();
        return t.flags |= 1, e !== null && o ? (t.child = Sn(t, e.child, null, i), t.child = Sn(t, null, u, i)) : he(e, t, u, i), t.memoizedState = r.state, l && Vu(t, n, !0), t.child;
    }
    function fc(e) {
        var t = e.stateNode;
        t.pendingContext ? Au(e, t.pendingContext, t.pendingContext !== t.context) : t.context && Au(e, t.context, !1), Vo(e, t.containerInfo);
    }
    function ts(e, t, n, r, l) {
        return wn(), zo(l), t.flags |= 256, he(e, t, n, r), t.child;
    }
    var Ji = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0
    };
    function bi(e) {
        return {
            baseLanes: e,
            cachePool: null,
            transitions: null
        };
    }
    function dc(e, t, n) {
        var r = t.pendingProps, l = Q.current, i = !1, o = (t.flags & 128) !== 0, u;
        if ((u = o) || (u = e !== null && e.memoizedState === null ? !1 : (l & 2) !== 0), u ? (i = !0, t.flags &= -129) : (e === null || e.memoizedState !== null) && (l |= 1), V(Q, l & 1), e === null) return Qi(t), e = t.memoizedState, e !== null && (e = e.dehydrated, e !== null) ? (t.mode & 1 ? e.data === "$!" ? t.lanes = 8 : t.lanes = 1073741824 : t.lanes = 1, null) : (o = r.children, e = r.fallback, i ? (r = t.mode, i = t.child, o = {
            mode: "hidden",
            children: o
        }, !(r & 1) && i !== null ? (i.childLanes = 0, i.pendingProps = o) : i = Ol(o, r, 0, null), e = Wt(e, r, n, null), i.return = t, e.return = t, i.sibling = e, t.child = i, t.child.memoizedState = bi(n), t.memoizedState = Ji, e) : Ko(t, o));
        if (l = e.memoizedState, l !== null && (u = l.dehydrated, u !== null)) return Bd(e, t, o, r, u, l, n);
        if (i) {
            i = r.fallback, o = t.mode, l = e.child, u = l.sibling;
            var s = {
                mode: "hidden",
                children: r.children
            };
            return !(o & 1) && t.child !== l ? (r = t.child, r.childLanes = 0, r.pendingProps = s, t.deletions = null) : (r = Ct(l, s), r.subtreeFlags = l.subtreeFlags & 14680064), u !== null ? i = Ct(u, i) : (i = Wt(i, o, n, null), i.flags |= 2), i.return = t, r.return = t, r.sibling = i, t.child = r, r = i, i = t.child, o = e.child.memoizedState, o = o === null ? bi(n) : {
                baseLanes: o.baseLanes | n,
                cachePool: null,
                transitions: o.transitions
            }, i.memoizedState = o, i.childLanes = e.childLanes & ~n, t.memoizedState = Ji, r;
        }
        return i = e.child, e = i.sibling, r = Ct(i, {
            mode: "visible",
            children: r.children
        }), !(t.mode & 1) && (r.lanes = n), r.return = t, r.sibling = null, e !== null && (n = t.deletions, n === null ? (t.deletions = [
            e
        ], t.flags |= 16) : n.push(e)), t.child = r, t.memoizedState = null, r;
    }
    function Ko(e, t) {
        return t = Ol({
            mode: "visible",
            children: t
        }, e.mode, 0, null), t.return = e, e.child = t;
    }
    function Or(e, t, n, r) {
        return r !== null && zo(r), Sn(t, e.child, null, n), e = Ko(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
    }
    function Bd(e, t, n, r, l, i, o) {
        if (n) return t.flags & 256 ? (t.flags &= -257, r = ai(Error(S(422))), Or(e, t, o, r)) : t.memoizedState !== null ? (t.child = e.child, t.flags |= 128, null) : (i = r.fallback, l = t.mode, r = Ol({
            mode: "visible",
            children: r.children
        }, l, 0, null), i = Wt(i, l, o, null), i.flags |= 2, r.return = t, i.return = t, r.sibling = i, t.child = r, t.mode & 1 && Sn(t, e.child, null, o), t.child.memoizedState = bi(o), t.memoizedState = Ji, i);
        if (!(t.mode & 1)) return Or(e, t, o, null);
        if (l.data === "$!") {
            if (r = l.nextSibling && l.nextSibling.dataset, r) var u = r.dgst;
            return r = u, i = Error(S(419)), r = ai(i, r, void 0), Or(e, t, o, r);
        }
        if (u = (o & e.childLanes) !== 0, Se || u) {
            if (r = ie, r !== null) {
                switch(o & -o){
                    case 4:
                        l = 2;
                        break;
                    case 16:
                        l = 8;
                        break;
                    case 64:
                    case 128:
                    case 256:
                    case 512:
                    case 1024:
                    case 2048:
                    case 4096:
                    case 8192:
                    case 16384:
                    case 32768:
                    case 65536:
                    case 131072:
                    case 262144:
                    case 524288:
                    case 1048576:
                    case 2097152:
                    case 4194304:
                    case 8388608:
                    case 16777216:
                    case 33554432:
                    case 67108864:
                        l = 32;
                        break;
                    case 536870912:
                        l = 268435456;
                        break;
                    default:
                        l = 0;
                }
                l = l & (r.suspendedLanes | o) ? 0 : l, l !== 0 && l !== i.retryLane && (i.retryLane = l, ot(e, l), Be(r, e, l, -1));
            }
            return bo(), r = ai(Error(S(421))), Or(e, t, o, r);
        }
        return l.data === "$?" ? (t.flags |= 128, t.child = e.child, t = np.bind(null, e), l._reactRetry = t, null) : (e = i.treeContext, Ce = kt(l.nextSibling), Ne = t, H = !0, We = null, e !== null && (je[ze++] = tt, je[ze++] = nt, je[ze++] = Bt, tt = e.id, nt = e.overflow, Bt = t), t = Ko(t, r.children), t.flags |= 4096, t);
    }
    function ns(e, t, n) {
        e.lanes |= t;
        var r = e.alternate;
        r !== null && (r.lanes |= t), Gi(e.return, t, n);
    }
    function ci(e, t, n, r, l) {
        var i = e.memoizedState;
        i === null ? e.memoizedState = {
            isBackwards: t,
            rendering: null,
            renderingStartTime: 0,
            last: r,
            tail: n,
            tailMode: l
        } : (i.isBackwards = t, i.rendering = null, i.renderingStartTime = 0, i.last = r, i.tail = n, i.tailMode = l);
    }
    function pc(e, t, n) {
        var r = t.pendingProps, l = r.revealOrder, i = r.tail;
        if (he(e, t, r.children, n), r = Q.current, r & 2) r = r & 1 | 2, t.flags |= 128;
        else {
            if (e !== null && e.flags & 128) e: for(e = t.child; e !== null;){
                if (e.tag === 13) e.memoizedState !== null && ns(e, n, t);
                else if (e.tag === 19) ns(e, n, t);
                else if (e.child !== null) {
                    e.child.return = e, e = e.child;
                    continue;
                }
                if (e === t) break e;
                for(; e.sibling === null;){
                    if (e.return === null || e.return === t) break e;
                    e = e.return;
                }
                e.sibling.return = e.return, e = e.sibling;
            }
            r &= 1;
        }
        if (V(Q, r), !(t.mode & 1)) t.memoizedState = null;
        else switch(l){
            case "forwards":
                for(n = t.child, l = null; n !== null;)e = n.alternate, e !== null && yl(e) === null && (l = n), n = n.sibling;
                n = l, n === null ? (l = t.child, t.child = null) : (l = n.sibling, n.sibling = null), ci(t, !1, l, n, i);
                break;
            case "backwards":
                for(n = null, l = t.child, t.child = null; l !== null;){
                    if (e = l.alternate, e !== null && yl(e) === null) {
                        t.child = l;
                        break;
                    }
                    e = l.sibling, l.sibling = n, n = l, l = e;
                }
                ci(t, !0, n, null, i);
                break;
            case "together":
                ci(t, !1, null, null, void 0);
                break;
            default:
                t.memoizedState = null;
        }
        return t.child;
    }
    function qr(e, t) {
        !(t.mode & 1) && e !== null && (e.alternate = null, t.alternate = null, t.flags |= 2);
    }
    function ut(e, t, n) {
        if (e !== null && (t.dependencies = e.dependencies), Qt |= t.lanes, !(n & t.childLanes)) return null;
        if (e !== null && t.child !== e.child) throw Error(S(153));
        if (t.child !== null) {
            for(e = t.child, n = Ct(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;)e = e.sibling, n = n.sibling = Ct(e, e.pendingProps), n.return = t;
            n.sibling = null;
        }
        return t.child;
    }
    function Hd(e, t, n) {
        switch(t.tag){
            case 3:
                fc(t), wn();
                break;
            case 5:
                Va(t);
                break;
            case 1:
                xe(t.type) && fl(t);
                break;
            case 4:
                Vo(t, t.stateNode.containerInfo);
                break;
            case 10:
                var r = t.type._context, l = t.memoizedProps.value;
                V(hl, r._currentValue), r._currentValue = l;
                break;
            case 13:
                if (r = t.memoizedState, r !== null) return r.dehydrated !== null ? (V(Q, Q.current & 1), t.flags |= 128, null) : n & t.child.childLanes ? dc(e, t, n) : (V(Q, Q.current & 1), e = ut(e, t, n), e !== null ? e.sibling : null);
                V(Q, Q.current & 1);
                break;
            case 19:
                if (r = (n & t.childLanes) !== 0, e.flags & 128) {
                    if (r) return pc(e, t, n);
                    t.flags |= 128;
                }
                if (l = t.memoizedState, l !== null && (l.rendering = null, l.tail = null, l.lastEffect = null), V(Q, Q.current), r) break;
                return null;
            case 22:
            case 23:
                return t.lanes = 0, ac(e, t, n);
        }
        return ut(e, t, n);
    }
    var hc, eo, mc, vc;
    hc = function(e, t) {
        for(var n = t.child; n !== null;){
            if (n.tag === 5 || n.tag === 6) e.appendChild(n.stateNode);
            else if (n.tag !== 4 && n.child !== null) {
                n.child.return = n, n = n.child;
                continue;
            }
            if (n === t) break;
            for(; n.sibling === null;){
                if (n.return === null || n.return === t) return;
                n = n.return;
            }
            n.sibling.return = n.return, n = n.sibling;
        }
    };
    eo = function() {};
    mc = function(e, t, n, r) {
        var l = e.memoizedProps;
        if (l !== r) {
            e = t.stateNode, Vt(Xe.current);
            var i = null;
            switch(n){
                case "input":
                    l = xi(e, l), r = xi(e, r), i = [];
                    break;
                case "select":
                    l = K({}, l, {
                        value: void 0
                    }), r = K({}, r, {
                        value: void 0
                    }), i = [];
                    break;
                case "textarea":
                    l = Ci(e, l), r = Ci(e, r), i = [];
                    break;
                default:
                    typeof l.onClick != "function" && typeof r.onClick == "function" && (e.onclick = al);
            }
            Ti(n, r);
            var o;
            n = null;
            for(a in l)if (!r.hasOwnProperty(a) && l.hasOwnProperty(a) && l[a] != null) if (a === "style") {
                var u = l[a];
                for(o in u)u.hasOwnProperty(o) && (n || (n = {}), n[o] = "");
            } else a !== "dangerouslySetInnerHTML" && a !== "children" && a !== "suppressContentEditableWarning" && a !== "suppressHydrationWarning" && a !== "autoFocus" && (er.hasOwnProperty(a) ? i || (i = []) : (i = i || []).push(a, null));
            for(a in r){
                var s = r[a];
                if (u = l?.[a], r.hasOwnProperty(a) && s !== u && (s != null || u != null)) if (a === "style") if (u) {
                    for(o in u)!u.hasOwnProperty(o) || s && s.hasOwnProperty(o) || (n || (n = {}), n[o] = "");
                    for(o in s)s.hasOwnProperty(o) && u[o] !== s[o] && (n || (n = {}), n[o] = s[o]);
                } else n || (i || (i = []), i.push(a, n)), n = s;
                else a === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, u = u ? u.__html : void 0, s != null && u !== s && (i = i || []).push(a, s)) : a === "children" ? typeof s != "string" && typeof s != "number" || (i = i || []).push(a, "" + s) : a !== "suppressContentEditableWarning" && a !== "suppressHydrationWarning" && (er.hasOwnProperty(a) ? (s != null && a === "onScroll" && U("scroll", e), i || u === s || (i = [])) : (i = i || []).push(a, s));
            }
            n && (i = i || []).push("style", n);
            var a = i;
            (t.updateQueue = a) && (t.flags |= 4);
        }
    };
    vc = function(e, t, n, r) {
        n !== r && (t.flags |= 4);
    };
    function On(e, t) {
        if (!H) switch(e.tailMode){
            case "hidden":
                t = e.tail;
                for(var n = null; t !== null;)t.alternate !== null && (n = t), t = t.sibling;
                n === null ? e.tail = null : n.sibling = null;
                break;
            case "collapsed":
                n = e.tail;
                for(var r = null; n !== null;)n.alternate !== null && (r = n), n = n.sibling;
                r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
        }
    }
    function ce(e) {
        var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
        if (t) for(var l = e.child; l !== null;)n |= l.lanes | l.childLanes, r |= l.subtreeFlags & 14680064, r |= l.flags & 14680064, l.return = e, l = l.sibling;
        else for(l = e.child; l !== null;)n |= l.lanes | l.childLanes, r |= l.subtreeFlags, r |= l.flags, l.return = e, l = l.sibling;
        return e.subtreeFlags |= r, e.childLanes = n, t;
    }
    function Qd(e, t, n) {
        var r = t.pendingProps;
        switch(jo(t), t.tag){
            case 2:
            case 16:
            case 15:
            case 0:
            case 11:
            case 7:
            case 8:
            case 12:
            case 9:
            case 14:
                return ce(t), null;
            case 1:
                return xe(t.type) && cl(), ce(t), null;
            case 3:
                return r = t.stateNode, kn(), W(ke), W(de), Wo(), r.pendingContext && (r.context = r.pendingContext, r.pendingContext = null), (e === null || e.child === null) && (Ir(t) ? t.flags |= 4 : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, We !== null && (so(We), We = null))), eo(e, t), ce(t), null;
            case 5:
                Uo(t);
                var l = Vt(dr.current);
                if (n = t.type, e !== null && t.stateNode != null) mc(e, t, n, r, l), e.ref !== t.ref && (t.flags |= 512, t.flags |= 2097152);
                else {
                    if (!r) {
                        if (t.stateNode === null) throw Error(S(166));
                        return ce(t), null;
                    }
                    if (e = Vt(Xe.current), Ir(t)) {
                        r = t.stateNode, n = t.type;
                        var i = t.memoizedProps;
                        switch(r[Ke] = t, r[cr] = i, e = (t.mode & 1) !== 0, n){
                            case "dialog":
                                U("cancel", r), U("close", r);
                                break;
                            case "iframe":
                            case "object":
                            case "embed":
                                U("load", r);
                                break;
                            case "video":
                            case "audio":
                                for(l = 0; l < Wn.length; l++)U(Wn[l], r);
                                break;
                            case "source":
                                U("error", r);
                                break;
                            case "img":
                            case "image":
                            case "link":
                                U("error", r), U("load", r);
                                break;
                            case "details":
                                U("toggle", r);
                                break;
                            case "input":
                                fu(r, i), U("invalid", r);
                                break;
                            case "select":
                                r._wrapperState = {
                                    wasMultiple: !!i.multiple
                                }, U("invalid", r);
                                break;
                            case "textarea":
                                pu(r, i), U("invalid", r);
                        }
                        Ti(n, i), l = null;
                        for(var o in i)if (i.hasOwnProperty(o)) {
                            var u = i[o];
                            o === "children" ? typeof u == "string" ? r.textContent !== u && (i.suppressHydrationWarning !== !0 && zr(r.textContent, u, e), l = [
                                "children",
                                u
                            ]) : typeof u == "number" && r.textContent !== "" + u && (i.suppressHydrationWarning !== !0 && zr(r.textContent, u, e), l = [
                                "children",
                                "" + u
                            ]) : er.hasOwnProperty(o) && u != null && o === "onScroll" && U("scroll", r);
                        }
                        switch(n){
                            case "input":
                                Cr(r), du(r, i, !0);
                                break;
                            case "textarea":
                                Cr(r), hu(r);
                                break;
                            case "select":
                            case "option":
                                break;
                            default:
                                typeof i.onClick == "function" && (r.onclick = al);
                        }
                        r = l, t.updateQueue = r, r !== null && (t.flags |= 4);
                    } else {
                        o = l.nodeType === 9 ? l : l.ownerDocument, e === "http://www.w3.org/1999/xhtml" && (e = Hs(n)), e === "http://www.w3.org/1999/xhtml" ? n === "script" ? (e = o.createElement("div"), e.innerHTML = "<script><\/script>", e = e.removeChild(e.firstChild)) : typeof r.is == "string" ? e = o.createElement(n, {
                            is: r.is
                        }) : (e = o.createElement(n), n === "select" && (o = e, r.multiple ? o.multiple = !0 : r.size && (o.size = r.size))) : e = o.createElementNS(e, n), e[Ke] = t, e[cr] = r, hc(e, t, !1, !1), t.stateNode = e;
                        e: {
                            switch(o = Pi(n, r), n){
                                case "dialog":
                                    U("cancel", e), U("close", e), l = r;
                                    break;
                                case "iframe":
                                case "object":
                                case "embed":
                                    U("load", e), l = r;
                                    break;
                                case "video":
                                case "audio":
                                    for(l = 0; l < Wn.length; l++)U(Wn[l], e);
                                    l = r;
                                    break;
                                case "source":
                                    U("error", e), l = r;
                                    break;
                                case "img":
                                case "image":
                                case "link":
                                    U("error", e), U("load", e), l = r;
                                    break;
                                case "details":
                                    U("toggle", e), l = r;
                                    break;
                                case "input":
                                    fu(e, r), l = xi(e, r), U("invalid", e);
                                    break;
                                case "option":
                                    l = r;
                                    break;
                                case "select":
                                    e._wrapperState = {
                                        wasMultiple: !!r.multiple
                                    }, l = K({}, r, {
                                        value: void 0
                                    }), U("invalid", e);
                                    break;
                                case "textarea":
                                    pu(e, r), l = Ci(e, r), U("invalid", e);
                                    break;
                                default:
                                    l = r;
                            }
                            Ti(n, l), u = l;
                            for(i in u)if (u.hasOwnProperty(i)) {
                                var s = u[i];
                                i === "style" ? Ks(e, s) : i === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, s != null && Qs(e, s)) : i === "children" ? typeof s == "string" ? (n !== "textarea" || s !== "") && tr(e, s) : typeof s == "number" && tr(e, "" + s) : i !== "suppressContentEditableWarning" && i !== "suppressHydrationWarning" && i !== "autoFocus" && (er.hasOwnProperty(i) ? s != null && i === "onScroll" && U("scroll", e) : s != null && yo(e, i, s, o));
                            }
                            switch(n){
                                case "input":
                                    Cr(e), du(e, r, !1);
                                    break;
                                case "textarea":
                                    Cr(e), hu(e);
                                    break;
                                case "option":
                                    r.value != null && e.setAttribute("value", "" + Nt(r.value));
                                    break;
                                case "select":
                                    e.multiple = !!r.multiple, i = r.value, i != null ? fn(e, !!r.multiple, i, !1) : r.defaultValue != null && fn(e, !!r.multiple, r.defaultValue, !0);
                                    break;
                                default:
                                    typeof l.onClick == "function" && (e.onclick = al);
                            }
                            switch(n){
                                case "button":
                                case "input":
                                case "select":
                                case "textarea":
                                    r = !!r.autoFocus;
                                    break e;
                                case "img":
                                    r = !0;
                                    break e;
                                default:
                                    r = !1;
                            }
                        }
                        r && (t.flags |= 4);
                    }
                    t.ref !== null && (t.flags |= 512, t.flags |= 2097152);
                }
                return ce(t), null;
            case 6:
                if (e && t.stateNode != null) vc(e, t, e.memoizedProps, r);
                else {
                    if (typeof r != "string" && t.stateNode === null) throw Error(S(166));
                    if (n = Vt(dr.current), Vt(Xe.current), Ir(t)) {
                        if (r = t.stateNode, n = t.memoizedProps, r[Ke] = t, (i = r.nodeValue !== n) && (e = Ne, e !== null)) switch(e.tag){
                            case 3:
                                zr(r.nodeValue, n, (e.mode & 1) !== 0);
                                break;
                            case 5:
                                e.memoizedProps.suppressHydrationWarning !== !0 && zr(r.nodeValue, n, (e.mode & 1) !== 0);
                        }
                        i && (t.flags |= 4);
                    } else r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r), r[Ke] = t, t.stateNode = r;
                }
                return ce(t), null;
            case 13:
                if (W(Q), r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
                    if (H && Ce !== null && t.mode & 1 && !(t.flags & 128)) Ia(), wn(), t.flags |= 98560, i = !1;
                    else if (i = Ir(t), r !== null && r.dehydrated !== null) {
                        if (e === null) {
                            if (!i) throw Error(S(318));
                            if (i = t.memoizedState, i = i !== null ? i.dehydrated : null, !i) throw Error(S(317));
                            i[Ke] = t;
                        } else wn(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
                        ce(t), i = !1;
                    } else We !== null && (so(We), We = null), i = !0;
                    if (!i) return t.flags & 65536 ? t : null;
                }
                return t.flags & 128 ? (t.lanes = n, t) : (r = r !== null, r !== (e !== null && e.memoizedState !== null) && r && (t.child.flags |= 8192, t.mode & 1 && (e === null || Q.current & 1 ? te === 0 && (te = 3) : bo())), t.updateQueue !== null && (t.flags |= 4), ce(t), null);
            case 4:
                return kn(), eo(e, t), e === null && sr(t.stateNode.containerInfo), ce(t), null;
            case 10:
                return Oo(t.type._context), ce(t), null;
            case 17:
                return xe(t.type) && cl(), ce(t), null;
            case 19:
                if (W(Q), i = t.memoizedState, i === null) return ce(t), null;
                if (r = (t.flags & 128) !== 0, o = i.rendering, o === null) if (r) On(i, !1);
                else {
                    if (te !== 0 || e !== null && e.flags & 128) for(e = t.child; e !== null;){
                        if (o = yl(e), o !== null) {
                            for(t.flags |= 128, On(i, !1), r = o.updateQueue, r !== null && (t.updateQueue = r, t.flags |= 4), t.subtreeFlags = 0, r = n, n = t.child; n !== null;)i = n, e = r, i.flags &= 14680066, o = i.alternate, o === null ? (i.childLanes = 0, i.lanes = e, i.child = null, i.subtreeFlags = 0, i.memoizedProps = null, i.memoizedState = null, i.updateQueue = null, i.dependencies = null, i.stateNode = null) : (i.childLanes = o.childLanes, i.lanes = o.lanes, i.child = o.child, i.subtreeFlags = 0, i.deletions = null, i.memoizedProps = o.memoizedProps, i.memoizedState = o.memoizedState, i.updateQueue = o.updateQueue, i.type = o.type, e = o.dependencies, i.dependencies = e === null ? null : {
                                lanes: e.lanes,
                                firstContext: e.firstContext
                            }), n = n.sibling;
                            return V(Q, Q.current & 1 | 2), t.child;
                        }
                        e = e.sibling;
                    }
                    i.tail !== null && q() > En && (t.flags |= 128, r = !0, On(i, !1), t.lanes = 4194304);
                }
                else {
                    if (!r) if (e = yl(o), e !== null) {
                        if (t.flags |= 128, r = !0, n = e.updateQueue, n !== null && (t.updateQueue = n, t.flags |= 4), On(i, !0), i.tail === null && i.tailMode === "hidden" && !o.alternate && !H) return ce(t), null;
                    } else 2 * q() - i.renderingStartTime > En && n !== 1073741824 && (t.flags |= 128, r = !0, On(i, !1), t.lanes = 4194304);
                    i.isBackwards ? (o.sibling = t.child, t.child = o) : (n = i.last, n !== null ? n.sibling = o : t.child = o, i.last = o);
                }
                return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = q(), t.sibling = null, n = Q.current, V(Q, r ? n & 1 | 2 : n & 1), t) : (ce(t), null);
            case 22:
            case 23:
                return Jo(), r = t.memoizedState !== null, e !== null && e.memoizedState !== null !== r && (t.flags |= 8192), r && t.mode & 1 ? _e & 1073741824 && (ce(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : ce(t), null;
            case 24:
                return null;
            case 25:
                return null;
        }
        throw Error(S(156, t.tag));
    }
    function Gd(e, t) {
        switch(jo(t), t.tag){
            case 1:
                return xe(t.type) && cl(), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
            case 3:
                return kn(), W(ke), W(de), Wo(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
            case 5:
                return Uo(t), null;
            case 13:
                if (W(Q), e = t.memoizedState, e !== null && e.dehydrated !== null) {
                    if (t.alternate === null) throw Error(S(340));
                    wn();
                }
                return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
            case 19:
                return W(Q), null;
            case 4:
                return kn(), null;
            case 10:
                return Oo(t.type._context), null;
            case 22:
            case 23:
                return Jo(), null;
            case 24:
                return null;
            default:
                return null;
        }
    }
    var Dr = !1, fe = !1, Kd = typeof WeakSet == "function" ? WeakSet : Set, N = null;
    function an(e, t) {
        var n = e.ref;
        if (n !== null) if (typeof n == "function") try {
            n(null);
        } catch (r) {
            X(e, t, r);
        }
        else n.current = null;
    }
    function to(e, t, n) {
        try {
            n();
        } catch (r) {
            X(e, t, r);
        }
    }
    var rs = !1;
    function Yd(e, t) {
        if (Ai = ol, e = ka(), Lo(e)) {
            if ("selectionStart" in e) var n = {
                start: e.selectionStart,
                end: e.selectionEnd
            };
            else e: {
                n = (n = e.ownerDocument) && n.defaultView || window;
                var r = n.getSelection && n.getSelection();
                if (r && r.rangeCount !== 0) {
                    n = r.anchorNode;
                    var l = r.anchorOffset, i = r.focusNode;
                    r = r.focusOffset;
                    try {
                        n.nodeType, i.nodeType;
                    } catch  {
                        n = null;
                        break e;
                    }
                    var o = 0, u = -1, s = -1, a = 0, v = 0, m = e, p = null;
                    t: for(;;){
                        for(var g; m !== n || l !== 0 && m.nodeType !== 3 || (u = o + l), m !== i || r !== 0 && m.nodeType !== 3 || (s = o + r), m.nodeType === 3 && (o += m.nodeValue.length), (g = m.firstChild) !== null;)p = m, m = g;
                        for(;;){
                            if (m === e) break t;
                            if (p === n && ++a === l && (u = o), p === i && ++v === r && (s = o), (g = m.nextSibling) !== null) break;
                            m = p, p = m.parentNode;
                        }
                        m = g;
                    }
                    n = u === -1 || s === -1 ? null : {
                        start: u,
                        end: s
                    };
                } else n = null;
            }
            n = n || {
                start: 0,
                end: 0
            };
        } else n = null;
        for(Vi = {
            focusedElem: e,
            selectionRange: n
        }, ol = !1, N = t; N !== null;)if (t = N, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null) e.return = t, N = e;
        else for(; N !== null;){
            t = N;
            try {
                var k = t.alternate;
                if (t.flags & 1024) switch(t.tag){
                    case 0:
                    case 11:
                    case 15:
                        break;
                    case 1:
                        if (k !== null) {
                            var E = k.memoizedProps, O = k.memoizedState, f = t.stateNode, c = f.getSnapshotBeforeUpdate(t.elementType === t.type ? E : Ve(t.type, E), O);
                            f.__reactInternalSnapshotBeforeUpdate = c;
                        }
                        break;
                    case 3:
                        var d = t.stateNode.containerInfo;
                        d.nodeType === 1 ? d.textContent = "" : d.nodeType === 9 && d.documentElement && d.removeChild(d.documentElement);
                        break;
                    case 5:
                    case 6:
                    case 4:
                    case 17:
                        break;
                    default:
                        throw Error(S(163));
                }
            } catch (w) {
                X(t, t.return, w);
            }
            if (e = t.sibling, e !== null) {
                e.return = t.return, N = e;
                break;
            }
            N = t.return;
        }
        return k = rs, rs = !1, k;
    }
    function qn(e, t, n) {
        var r = t.updateQueue;
        if (r = r !== null ? r.lastEffect : null, r !== null) {
            var l = r = r.next;
            do {
                if ((l.tag & e) === e) {
                    var i = l.destroy;
                    l.destroy = void 0, i !== void 0 && to(t, n, i);
                }
                l = l.next;
            }while (l !== r);
        }
    }
    function Il(e, t) {
        if (t = t.updateQueue, t = t !== null ? t.lastEffect : null, t !== null) {
            var n = t = t.next;
            do {
                if ((n.tag & e) === e) {
                    var r = n.create;
                    n.destroy = r();
                }
                n = n.next;
            }while (n !== t);
        }
    }
    function no(e) {
        var t = e.ref;
        if (t !== null) {
            var n = e.stateNode;
            switch(e.tag){
                case 5:
                    e = n;
                    break;
                default:
                    e = n;
            }
            typeof t == "function" ? t(e) : t.current = e;
        }
    }
    function yc(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, yc(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && (delete t[Ke], delete t[cr], delete t[$i], delete t[Ld], delete t[Fd])), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
    }
    function gc(e) {
        return e.tag === 5 || e.tag === 3 || e.tag === 4;
    }
    function ls(e) {
        e: for(;;){
            for(; e.sibling === null;){
                if (e.return === null || gc(e.return)) return null;
                e = e.return;
            }
            for(e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;){
                if (e.flags & 2 || e.child === null || e.tag === 4) continue e;
                e.child.return = e, e = e.child;
            }
            if (!(e.flags & 2)) return e.stateNode;
        }
    }
    function ro(e, t, n) {
        var r = e.tag;
        if (r === 5 || r === 6) e = e.stateNode, t ? n.nodeType === 8 ? n.parentNode.insertBefore(e, t) : n.insertBefore(e, t) : (n.nodeType === 8 ? (t = n.parentNode, t.insertBefore(e, n)) : (t = n, t.appendChild(e)), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = al));
        else if (r !== 4 && (e = e.child, e !== null)) for(ro(e, t, n), e = e.sibling; e !== null;)ro(e, t, n), e = e.sibling;
    }
    function lo(e, t, n) {
        var r = e.tag;
        if (r === 5 || r === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
        else if (r !== 4 && (e = e.child, e !== null)) for(lo(e, t, n), e = e.sibling; e !== null;)lo(e, t, n), e = e.sibling;
    }
    var oe = null, Ue = !1;
    function ft(e, t, n) {
        for(n = n.child; n !== null;)wc(e, t, n), n = n.sibling;
    }
    function wc(e, t, n) {
        if (Ye && typeof Ye.onCommitFiberUnmount == "function") try {
            Ye.onCommitFiberUnmount(Nl, n);
        } catch  {}
        switch(n.tag){
            case 5:
                fe || an(n, t);
            case 6:
                var r = oe, l = Ue;
                oe = null, ft(e, t, n), oe = r, Ue = l, oe !== null && (Ue ? (e = oe, n = n.stateNode, e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n)) : oe.removeChild(n.stateNode));
                break;
            case 18:
                oe !== null && (Ue ? (e = oe, n = n.stateNode, e.nodeType === 8 ? ri(e.parentNode, n) : e.nodeType === 1 && ri(e, n), ir(e)) : ri(oe, n.stateNode));
                break;
            case 4:
                r = oe, l = Ue, oe = n.stateNode.containerInfo, Ue = !0, ft(e, t, n), oe = r, Ue = l;
                break;
            case 0:
            case 11:
            case 14:
            case 15:
                if (!fe && (r = n.updateQueue, r !== null && (r = r.lastEffect, r !== null))) {
                    l = r = r.next;
                    do {
                        var i = l, o = i.destroy;
                        i = i.tag, o !== void 0 && (i & 2 || i & 4) && to(n, t, o), l = l.next;
                    }while (l !== r);
                }
                ft(e, t, n);
                break;
            case 1:
                if (!fe && (an(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function")) try {
                    r.props = n.memoizedProps, r.state = n.memoizedState, r.componentWillUnmount();
                } catch (u) {
                    X(n, t, u);
                }
                ft(e, t, n);
                break;
            case 21:
                ft(e, t, n);
                break;
            case 22:
                n.mode & 1 ? (fe = (r = fe) || n.memoizedState !== null, ft(e, t, n), fe = r) : ft(e, t, n);
                break;
            default:
                ft(e, t, n);
        }
    }
    function is(e) {
        var t = e.updateQueue;
        if (t !== null) {
            e.updateQueue = null;
            var n = e.stateNode;
            n === null && (n = e.stateNode = new Kd), t.forEach(function(r) {
                var l = rp.bind(null, e, r);
                n.has(r) || (n.add(r), r.then(l, l));
            });
        }
    }
    function Ae(e, t) {
        var n = t.deletions;
        if (n !== null) for(var r = 0; r < n.length; r++){
            var l = n[r];
            try {
                var i = e, o = t, u = o;
                e: for(; u !== null;){
                    switch(u.tag){
                        case 5:
                            oe = u.stateNode, Ue = !1;
                            break e;
                        case 3:
                            oe = u.stateNode.containerInfo, Ue = !0;
                            break e;
                        case 4:
                            oe = u.stateNode.containerInfo, Ue = !0;
                            break e;
                    }
                    u = u.return;
                }
                if (oe === null) throw Error(S(160));
                wc(i, o, l), oe = null, Ue = !1;
                var s = l.alternate;
                s !== null && (s.return = null), l.return = null;
            } catch (a) {
                X(l, t, a);
            }
        }
        if (t.subtreeFlags & 12854) for(t = t.child; t !== null;)Sc(t, e), t = t.sibling;
    }
    function Sc(e, t) {
        var n = e.alternate, r = e.flags;
        switch(e.tag){
            case 0:
            case 11:
            case 14:
            case 15:
                if (Ae(t, e), Qe(e), r & 4) {
                    try {
                        qn(3, e, e.return), Il(3, e);
                    } catch (E) {
                        X(e, e.return, E);
                    }
                    try {
                        qn(5, e, e.return);
                    } catch (E) {
                        X(e, e.return, E);
                    }
                }
                break;
            case 1:
                Ae(t, e), Qe(e), r & 512 && n !== null && an(n, n.return);
                break;
            case 5:
                if (Ae(t, e), Qe(e), r & 512 && n !== null && an(n, n.return), e.flags & 32) {
                    var l = e.stateNode;
                    try {
                        tr(l, "");
                    } catch (E) {
                        X(e, e.return, E);
                    }
                }
                if (r & 4 && (l = e.stateNode, l != null)) {
                    var i = e.memoizedProps, o = n !== null ? n.memoizedProps : i, u = e.type, s = e.updateQueue;
                    if (e.updateQueue = null, s !== null) try {
                        u === "input" && i.type === "radio" && i.name != null && $s(l, i), Pi(u, o);
                        var a = Pi(u, i);
                        for(o = 0; o < s.length; o += 2){
                            var v = s[o], m = s[o + 1];
                            v === "style" ? Ks(l, m) : v === "dangerouslySetInnerHTML" ? Qs(l, m) : v === "children" ? tr(l, m) : yo(l, v, m, a);
                        }
                        switch(u){
                            case "input":
                                Ei(l, i);
                                break;
                            case "textarea":
                                Bs(l, i);
                                break;
                            case "select":
                                var p = l._wrapperState.wasMultiple;
                                l._wrapperState.wasMultiple = !!i.multiple;
                                var g = i.value;
                                g != null ? fn(l, !!i.multiple, g, !1) : p !== !!i.multiple && (i.defaultValue != null ? fn(l, !!i.multiple, i.defaultValue, !0) : fn(l, !!i.multiple, i.multiple ? [] : "", !1));
                        }
                        l[cr] = i;
                    } catch (E) {
                        X(e, e.return, E);
                    }
                }
                break;
            case 6:
                if (Ae(t, e), Qe(e), r & 4) {
                    if (e.stateNode === null) throw Error(S(162));
                    l = e.stateNode, i = e.memoizedProps;
                    try {
                        l.nodeValue = i;
                    } catch (E) {
                        X(e, e.return, E);
                    }
                }
                break;
            case 3:
                if (Ae(t, e), Qe(e), r & 4 && n !== null && n.memoizedState.isDehydrated) try {
                    ir(t.containerInfo);
                } catch (E) {
                    X(e, e.return, E);
                }
                break;
            case 4:
                Ae(t, e), Qe(e);
                break;
            case 13:
                Ae(t, e), Qe(e), l = e.child, l.flags & 8192 && (i = l.memoizedState !== null, l.stateNode.isHidden = i, !i || l.alternate !== null && l.alternate.memoizedState !== null || (qo = q())), r & 4 && is(e);
                break;
            case 22:
                if (v = n !== null && n.memoizedState !== null, e.mode & 1 ? (fe = (a = fe) || v, Ae(t, e), fe = a) : Ae(t, e), Qe(e), r & 8192) {
                    if (a = e.memoizedState !== null, (e.stateNode.isHidden = a) && !v && e.mode & 1) for(N = e, v = e.child; v !== null;){
                        for(m = N = v; N !== null;){
                            switch(p = N, g = p.child, p.tag){
                                case 0:
                                case 11:
                                case 14:
                                case 15:
                                    qn(4, p, p.return);
                                    break;
                                case 1:
                                    an(p, p.return);
                                    var k = p.stateNode;
                                    if (typeof k.componentWillUnmount == "function") {
                                        r = p, n = p.return;
                                        try {
                                            t = r, k.props = t.memoizedProps, k.state = t.memoizedState, k.componentWillUnmount();
                                        } catch (E) {
                                            X(r, n, E);
                                        }
                                    }
                                    break;
                                case 5:
                                    an(p, p.return);
                                    break;
                                case 22:
                                    if (p.memoizedState !== null) {
                                        us(m);
                                        continue;
                                    }
                            }
                            g !== null ? (g.return = p, N = g) : us(m);
                        }
                        v = v.sibling;
                    }
                    e: for(v = null, m = e;;){
                        if (m.tag === 5) {
                            if (v === null) {
                                v = m;
                                try {
                                    l = m.stateNode, a ? (i = l.style, typeof i.setProperty == "function" ? i.setProperty("display", "none", "important") : i.display = "none") : (u = m.stateNode, s = m.memoizedProps.style, o = s != null && s.hasOwnProperty("display") ? s.display : null, u.style.display = Gs("display", o));
                                } catch (E) {
                                    X(e, e.return, E);
                                }
                            }
                        } else if (m.tag === 6) {
                            if (v === null) try {
                                m.stateNode.nodeValue = a ? "" : m.memoizedProps;
                            } catch (E) {
                                X(e, e.return, E);
                            }
                        } else if ((m.tag !== 22 && m.tag !== 23 || m.memoizedState === null || m === e) && m.child !== null) {
                            m.child.return = m, m = m.child;
                            continue;
                        }
                        if (m === e) break e;
                        for(; m.sibling === null;){
                            if (m.return === null || m.return === e) break e;
                            v === m && (v = null), m = m.return;
                        }
                        v === m && (v = null), m.sibling.return = m.return, m = m.sibling;
                    }
                }
                break;
            case 19:
                Ae(t, e), Qe(e), r & 4 && is(e);
                break;
            case 21:
                break;
            default:
                Ae(t, e), Qe(e);
        }
    }
    function Qe(e) {
        var t = e.flags;
        if (t & 2) {
            try {
                e: {
                    for(var n = e.return; n !== null;){
                        if (gc(n)) {
                            var r = n;
                            break e;
                        }
                        n = n.return;
                    }
                    throw Error(S(160));
                }
                switch(r.tag){
                    case 5:
                        var l = r.stateNode;
                        r.flags & 32 && (tr(l, ""), r.flags &= -33);
                        var i = ls(e);
                        lo(e, i, l);
                        break;
                    case 3:
                    case 4:
                        var o = r.stateNode.containerInfo, u = ls(e);
                        ro(e, u, o);
                        break;
                    default:
                        throw Error(S(161));
                }
            } catch (s) {
                X(e, e.return, s);
            }
            e.flags &= -3;
        }
        t & 4096 && (e.flags &= -4097);
    }
    function Xd(e, t, n) {
        N = e, kc(e);
    }
    function kc(e, t, n) {
        for(var r = (e.mode & 1) !== 0; N !== null;){
            var l = N, i = l.child;
            if (l.tag === 22 && r) {
                var o = l.memoizedState !== null || Dr;
                if (!o) {
                    var u = l.alternate, s = u !== null && u.memoizedState !== null || fe;
                    u = Dr;
                    var a = fe;
                    if (Dr = o, (fe = s) && !a) for(N = l; N !== null;)o = N, s = o.child, o.tag === 22 && o.memoizedState !== null ? ss(l) : s !== null ? (s.return = o, N = s) : ss(l);
                    for(; i !== null;)N = i, kc(i), i = i.sibling;
                    N = l, Dr = u, fe = a;
                }
                os(e);
            } else l.subtreeFlags & 8772 && i !== null ? (i.return = l, N = i) : os(e);
        }
    }
    function os(e) {
        for(; N !== null;){
            var t = N;
            if (t.flags & 8772) {
                var n = t.alternate;
                try {
                    if (t.flags & 8772) switch(t.tag){
                        case 0:
                        case 11:
                        case 15:
                            fe || Il(5, t);
                            break;
                        case 1:
                            var r = t.stateNode;
                            if (t.flags & 4 && !fe) if (n === null) r.componentDidMount();
                            else {
                                var l = t.elementType === t.type ? n.memoizedProps : Ve(t.type, n.memoizedProps);
                                r.componentDidUpdate(l, n.memoizedState, r.__reactInternalSnapshotBeforeUpdate);
                            }
                            var i = t.updateQueue;
                            i !== null && Hu(t, i, r);
                            break;
                        case 3:
                            var o = t.updateQueue;
                            if (o !== null) {
                                if (n = null, t.child !== null) switch(t.child.tag){
                                    case 5:
                                        n = t.child.stateNode;
                                        break;
                                    case 1:
                                        n = t.child.stateNode;
                                }
                                Hu(t, o, n);
                            }
                            break;
                        case 5:
                            var u = t.stateNode;
                            if (n === null && t.flags & 4) {
                                n = u;
                                var s = t.memoizedProps;
                                switch(t.type){
                                    case "button":
                                    case "input":
                                    case "select":
                                    case "textarea":
                                        s.autoFocus && n.focus();
                                        break;
                                    case "img":
                                        s.src && (n.src = s.src);
                                }
                            }
                            break;
                        case 6:
                            break;
                        case 4:
                            break;
                        case 12:
                            break;
                        case 13:
                            if (t.memoizedState === null) {
                                var a = t.alternate;
                                if (a !== null) {
                                    var v = a.memoizedState;
                                    if (v !== null) {
                                        var m = v.dehydrated;
                                        m !== null && ir(m);
                                    }
                                }
                            }
                            break;
                        case 19:
                        case 17:
                        case 21:
                        case 22:
                        case 23:
                        case 25:
                            break;
                        default:
                            throw Error(S(163));
                    }
                    fe || t.flags & 512 && no(t);
                } catch (p) {
                    X(t, t.return, p);
                }
            }
            if (t === e) {
                N = null;
                break;
            }
            if (n = t.sibling, n !== null) {
                n.return = t.return, N = n;
                break;
            }
            N = t.return;
        }
    }
    function us(e) {
        for(; N !== null;){
            var t = N;
            if (t === e) {
                N = null;
                break;
            }
            var n = t.sibling;
            if (n !== null) {
                n.return = t.return, N = n;
                break;
            }
            N = t.return;
        }
    }
    function ss(e) {
        for(; N !== null;){
            var t = N;
            try {
                switch(t.tag){
                    case 0:
                    case 11:
                    case 15:
                        var n = t.return;
                        try {
                            Il(4, t);
                        } catch (s) {
                            X(t, n, s);
                        }
                        break;
                    case 1:
                        var r = t.stateNode;
                        if (typeof r.componentDidMount == "function") {
                            var l = t.return;
                            try {
                                r.componentDidMount();
                            } catch (s) {
                                X(t, l, s);
                            }
                        }
                        var i = t.return;
                        try {
                            no(t);
                        } catch (s) {
                            X(t, i, s);
                        }
                        break;
                    case 5:
                        var o = t.return;
                        try {
                            no(t);
                        } catch (s) {
                            X(t, o, s);
                        }
                }
            } catch (s) {
                X(t, t.return, s);
            }
            if (t === e) {
                N = null;
                break;
            }
            var u = t.sibling;
            if (u !== null) {
                u.return = t.return, N = u;
                break;
            }
            N = t.return;
        }
    }
    var qd = Math.ceil, Sl = st.ReactCurrentDispatcher, Yo = st.ReactCurrentOwner, Me = st.ReactCurrentBatchConfig, D = 0, ie = null, J = null, ue = 0, _e = 0, cn = Rt(0), te = 0, vr = null, Qt = 0, Ml = 0, Xo = 0, Zn = null, ge = null, qo = 0, En = 1 / 0, Je = null, kl = !1, io = null, Et = null, Ar = !1, yt = null, xl = 0, Jn = 0, oo = null, Zr = -1, Jr = 0;
    function me() {
        return D & 6 ? q() : Zr !== -1 ? Zr : Zr = q();
    }
    function _t(e) {
        return e.mode & 1 ? D & 2 && ue !== 0 ? ue & -ue : zd.transition !== null ? (Jr === 0 && (Jr = ia()), Jr) : (e = A, e !== 0 || (e = window.event, e = e === void 0 ? 16 : da(e.type)), e) : 1;
    }
    function Be(e, t, n, r) {
        if (50 < Jn) throw Jn = 0, oo = null, Error(S(185));
        wr(e, n, r), (!(D & 2) || e !== ie) && (e === ie && (!(D & 2) && (Ml |= n), te === 4 && mt(e, ue)), Ee(e, r), n === 1 && D === 0 && !(t.mode & 1) && (En = q() + 500, Fl && Lt()));
    }
    function Ee(e, t) {
        var n = e.callbackNode;
        zf(e, t);
        var r = il(e, e === ie ? ue : 0);
        if (r === 0) n !== null && yu(n), e.callbackNode = null, e.callbackPriority = 0;
        else if (t = r & -r, e.callbackPriority !== t) {
            if (n != null && yu(n), t === 1) e.tag === 0 ? jd(as.bind(null, e)) : Fa(as.bind(null, e)), Pd(function() {
                !(D & 6) && Lt();
            }), n = null;
            else {
                switch(oa(r)){
                    case 1:
                        n = xo;
                        break;
                    case 4:
                        n = ra;
                        break;
                    case 16:
                        n = ll;
                        break;
                    case 536870912:
                        n = la;
                        break;
                    default:
                        n = ll;
                }
                n = Rc(n, xc.bind(null, e));
            }
            e.callbackPriority = t, e.callbackNode = n;
        }
    }
    function xc(e, t) {
        if (Zr = -1, Jr = 0, D & 6) throw Error(S(327));
        var n = e.callbackNode;
        if (vn() && e.callbackNode !== n) return null;
        var r = il(e, e === ie ? ue : 0);
        if (r === 0) return null;
        if (r & 30 || r & e.expiredLanes || t) t = El(e, r);
        else {
            t = r;
            var l = D;
            D |= 2;
            var i = _c();
            (ie !== e || ue !== t) && (Je = null, En = q() + 500, Ut(e, t));
            do try {
                bd();
                break;
            } catch (u) {
                Ec(e, u);
            }
            while (!0);
            Mo(), Sl.current = i, D = l, J !== null ? t = 0 : (ie = null, ue = 0, t = te);
        }
        if (t !== 0) {
            if (t === 2 && (l = zi(e), l !== 0 && (r = l, t = uo(e, l))), t === 1) throw n = vr, Ut(e, 0), mt(e, r), Ee(e, q()), n;
            if (t === 6) mt(e, r);
            else {
                if (l = e.current.alternate, !(r & 30) && !Zd(l) && (t = El(e, r), t === 2 && (i = zi(e), i !== 0 && (r = i, t = uo(e, i))), t === 1)) throw n = vr, Ut(e, 0), mt(e, r), Ee(e, q()), n;
                switch(e.finishedWork = l, e.finishedLanes = r, t){
                    case 0:
                    case 1:
                        throw Error(S(345));
                    case 2:
                        It(e, ge, Je);
                        break;
                    case 3:
                        if (mt(e, r), (r & 130023424) === r && (t = qo + 500 - q(), 10 < t)) {
                            if (il(e, 0) !== 0) break;
                            if (l = e.suspendedLanes, (l & r) !== r) {
                                me(), e.pingedLanes |= e.suspendedLanes & l;
                                break;
                            }
                            e.timeoutHandle = Wi(It.bind(null, e, ge, Je), t);
                            break;
                        }
                        It(e, ge, Je);
                        break;
                    case 4:
                        if (mt(e, r), (r & 4194240) === r) break;
                        for(t = e.eventTimes, l = -1; 0 < r;){
                            var o = 31 - $e(r);
                            i = 1 << o, o = t[o], o > l && (l = o), r &= ~i;
                        }
                        if (r = l, r = q() - r, r = (120 > r ? 120 : 480 > r ? 480 : 1080 > r ? 1080 : 1920 > r ? 1920 : 3e3 > r ? 3e3 : 4320 > r ? 4320 : 1960 * qd(r / 1960)) - r, 10 < r) {
                            e.timeoutHandle = Wi(It.bind(null, e, ge, Je), r);
                            break;
                        }
                        It(e, ge, Je);
                        break;
                    case 5:
                        It(e, ge, Je);
                        break;
                    default:
                        throw Error(S(329));
                }
            }
        }
        return Ee(e, q()), e.callbackNode === n ? xc.bind(null, e) : null;
    }
    function uo(e, t) {
        var n = Zn;
        return e.current.memoizedState.isDehydrated && (Ut(e, t).flags |= 256), e = El(e, t), e !== 2 && (t = ge, ge = n, t !== null && so(t)), e;
    }
    function so(e) {
        ge === null ? ge = e : ge.push.apply(ge, e);
    }
    function Zd(e) {
        for(var t = e;;){
            if (t.flags & 16384) {
                var n = t.updateQueue;
                if (n !== null && (n = n.stores, n !== null)) for(var r = 0; r < n.length; r++){
                    var l = n[r], i = l.getSnapshot;
                    l = l.value;
                    try {
                        if (!He(i(), l)) return !1;
                    } catch  {
                        return !1;
                    }
                }
            }
            if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
            else {
                if (t === e) break;
                for(; t.sibling === null;){
                    if (t.return === null || t.return === e) return !0;
                    t = t.return;
                }
                t.sibling.return = t.return, t = t.sibling;
            }
        }
        return !0;
    }
    function mt(e, t) {
        for(t &= ~Xo, t &= ~Ml, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t;){
            var n = 31 - $e(t), r = 1 << n;
            e[n] = -1, t &= ~r;
        }
    }
    function as(e) {
        if (D & 6) throw Error(S(327));
        vn();
        var t = il(e, 0);
        if (!(t & 1)) return Ee(e, q()), null;
        var n = El(e, t);
        if (e.tag !== 0 && n === 2) {
            var r = zi(e);
            r !== 0 && (t = r, n = uo(e, r));
        }
        if (n === 1) throw n = vr, Ut(e, 0), mt(e, t), Ee(e, q()), n;
        if (n === 6) throw Error(S(345));
        return e.finishedWork = e.current.alternate, e.finishedLanes = t, It(e, ge, Je), Ee(e, q()), null;
    }
    function Zo(e, t) {
        var n = D;
        D |= 1;
        try {
            return e(t);
        } finally{
            D = n, D === 0 && (En = q() + 500, Fl && Lt());
        }
    }
    function Gt(e) {
        yt !== null && yt.tag === 0 && !(D & 6) && vn();
        var t = D;
        D |= 1;
        var n = Me.transition, r = A;
        try {
            if (Me.transition = null, A = 1, e) return e();
        } finally{
            A = r, Me.transition = n, D = t, !(D & 6) && Lt();
        }
    }
    function Jo() {
        _e = cn.current, W(cn);
    }
    function Ut(e, t) {
        e.finishedWork = null, e.finishedLanes = 0;
        var n = e.timeoutHandle;
        if (n !== -1 && (e.timeoutHandle = -1, Td(n)), J !== null) for(n = J.return; n !== null;){
            var r = n;
            switch(jo(r), r.tag){
                case 1:
                    r = r.type.childContextTypes, r != null && cl();
                    break;
                case 3:
                    kn(), W(ke), W(de), Wo();
                    break;
                case 5:
                    Uo(r);
                    break;
                case 4:
                    kn();
                    break;
                case 13:
                    W(Q);
                    break;
                case 19:
                    W(Q);
                    break;
                case 10:
                    Oo(r.type._context);
                    break;
                case 22:
                case 23:
                    Jo();
            }
            n = n.return;
        }
        if (ie = e, J = e = Ct(e.current, null), ue = _e = t, te = 0, vr = null, Xo = Ml = Qt = 0, ge = Zn = null, At !== null) {
            for(t = 0; t < At.length; t++)if (n = At[t], r = n.interleaved, r !== null) {
                n.interleaved = null;
                var l = r.next, i = n.pending;
                if (i !== null) {
                    var o = i.next;
                    i.next = l, r.next = o;
                }
                n.pending = r;
            }
            At = null;
        }
        return e;
    }
    function Ec(e, t) {
        do {
            var n = J;
            try {
                if (Mo(), Yr.current = wl, gl) {
                    for(var r = G.memoizedState; r !== null;){
                        var l = r.queue;
                        l !== null && (l.pending = null), r = r.next;
                    }
                    gl = !1;
                }
                if (Ht = 0, le = ee = G = null, Xn = !1, pr = 0, Yo.current = null, n === null || n.return === null) {
                    te = 1, vr = t, J = null;
                    break;
                }
                e: {
                    var i = e, o = n.return, u = n, s = t;
                    if (t = ue, u.flags |= 32768, s !== null && typeof s == "object" && typeof s.then == "function") {
                        var a = s, v = u, m = v.tag;
                        if (!(v.mode & 1) && (m === 0 || m === 11 || m === 15)) {
                            var p = v.alternate;
                            p ? (v.updateQueue = p.updateQueue, v.memoizedState = p.memoizedState, v.lanes = p.lanes) : (v.updateQueue = null, v.memoizedState = null);
                        }
                        var g = qu(o);
                        if (g !== null) {
                            g.flags &= -257, Zu(g, o, u, i, t), g.mode & 1 && Xu(i, a, t), t = g, s = a;
                            var k = t.updateQueue;
                            if (k === null) {
                                var E = new Set;
                                E.add(s), t.updateQueue = E;
                            } else k.add(s);
                            break e;
                        } else {
                            if (!(t & 1)) {
                                Xu(i, a, t), bo();
                                break e;
                            }
                            s = Error(S(426));
                        }
                    } else if (H && u.mode & 1) {
                        var O = qu(o);
                        if (O !== null) {
                            !(O.flags & 65536) && (O.flags |= 256), Zu(O, o, u, i, t), zo(xn(s, u));
                            break e;
                        }
                    }
                    i = s = xn(s, u), te !== 4 && (te = 2), Zn === null ? Zn = [
                        i
                    ] : Zn.push(i), i = o;
                    do {
                        switch(i.tag){
                            case 3:
                                i.flags |= 65536, t &= -t, i.lanes |= t;
                                var f = oc(i, s, t);
                                Bu(i, f);
                                break e;
                            case 1:
                                u = s;
                                var c = i.type, d = i.stateNode;
                                if (!(i.flags & 128) && (typeof c.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (Et === null || !Et.has(d)))) {
                                    i.flags |= 65536, t &= -t, i.lanes |= t;
                                    var w = uc(i, u, t);
                                    Bu(i, w);
                                    break e;
                                }
                        }
                        i = i.return;
                    }while (i !== null);
                }
                Nc(n);
            } catch (_) {
                t = _, J === n && n !== null && (J = n = n.return);
                continue;
            }
            break;
        }while (!0);
    }
    function _c() {
        var e = Sl.current;
        return Sl.current = wl, e === null ? wl : e;
    }
    function bo() {
        (te === 0 || te === 3 || te === 2) && (te = 4), ie === null || !(Qt & 268435455) && !(Ml & 268435455) || mt(ie, ue);
    }
    function El(e, t) {
        var n = D;
        D |= 2;
        var r = _c();
        (ie !== e || ue !== t) && (Je = null, Ut(e, t));
        do try {
            Jd();
            break;
        } catch (l) {
            Ec(e, l);
        }
        while (!0);
        if (Mo(), D = n, Sl.current = r, J !== null) throw Error(S(261));
        return ie = null, ue = 0, te;
    }
    function Jd() {
        for(; J !== null;)Cc(J);
    }
    function bd() {
        for(; J !== null && !_f();)Cc(J);
    }
    function Cc(e) {
        var t = Pc(e.alternate, e, _e);
        e.memoizedProps = e.pendingProps, t === null ? Nc(e) : J = t, Yo.current = null;
    }
    function Nc(e) {
        var t = e;
        do {
            var n = t.alternate;
            if (e = t.return, t.flags & 32768) {
                if (n = Gd(n, t), n !== null) {
                    n.flags &= 32767, J = n;
                    return;
                }
                if (e !== null) e.flags |= 32768, e.subtreeFlags = 0, e.deletions = null;
                else {
                    te = 6, J = null;
                    return;
                }
            } else if (n = Qd(n, t, _e), n !== null) {
                J = n;
                return;
            }
            if (t = t.sibling, t !== null) {
                J = t;
                return;
            }
            J = t = e;
        }while (t !== null);
        te === 0 && (te = 5);
    }
    function It(e, t, n) {
        var r = A, l = Me.transition;
        try {
            Me.transition = null, A = 1, ep(e, t, n, r);
        } finally{
            Me.transition = l, A = r;
        }
        return null;
    }
    function ep(e, t, n, r) {
        do vn();
        while (yt !== null);
        if (D & 6) throw Error(S(327));
        n = e.finishedWork;
        var l = e.finishedLanes;
        if (n === null) return null;
        if (e.finishedWork = null, e.finishedLanes = 0, n === e.current) throw Error(S(177));
        e.callbackNode = null, e.callbackPriority = 0;
        var i = n.lanes | n.childLanes;
        if (If(e, i), e === ie && (J = ie = null, ue = 0), !(n.subtreeFlags & 2064) && !(n.flags & 2064) || Ar || (Ar = !0, Rc(ll, function() {
            return vn(), null;
        })), i = (n.flags & 15990) !== 0, n.subtreeFlags & 15990 || i) {
            i = Me.transition, Me.transition = null;
            var o = A;
            A = 1;
            var u = D;
            D |= 4, Yo.current = null, Yd(e, n), Sc(n, e), Sd(Vi), ol = !!Ai, Vi = Ai = null, e.current = n, Xd(n), Cf(), D = u, A = o, Me.transition = i;
        } else e.current = n;
        if (Ar && (Ar = !1, yt = e, xl = l), i = e.pendingLanes, i === 0 && (Et = null), Pf(n.stateNode), Ee(e, q()), t !== null) for(r = e.onRecoverableError, n = 0; n < t.length; n++)l = t[n], r(l.value, {
            componentStack: l.stack,
            digest: l.digest
        });
        if (kl) throw kl = !1, e = io, io = null, e;
        return xl & 1 && e.tag !== 0 && vn(), i = e.pendingLanes, i & 1 ? e === oo ? Jn++ : (Jn = 0, oo = e) : Jn = 0, Lt(), null;
    }
    function vn() {
        if (yt !== null) {
            var e = oa(xl), t = Me.transition, n = A;
            try {
                if (Me.transition = null, A = 16 > e ? 16 : e, yt === null) var r = !1;
                else {
                    if (e = yt, yt = null, xl = 0, D & 6) throw Error(S(331));
                    var l = D;
                    for(D |= 4, N = e.current; N !== null;){
                        var i = N, o = i.child;
                        if (N.flags & 16) {
                            var u = i.deletions;
                            if (u !== null) {
                                for(var s = 0; s < u.length; s++){
                                    var a = u[s];
                                    for(N = a; N !== null;){
                                        var v = N;
                                        switch(v.tag){
                                            case 0:
                                            case 11:
                                            case 15:
                                                qn(8, v, i);
                                        }
                                        var m = v.child;
                                        if (m !== null) m.return = v, N = m;
                                        else for(; N !== null;){
                                            v = N;
                                            var p = v.sibling, g = v.return;
                                            if (yc(v), v === a) {
                                                N = null;
                                                break;
                                            }
                                            if (p !== null) {
                                                p.return = g, N = p;
                                                break;
                                            }
                                            N = g;
                                        }
                                    }
                                }
                                var k = i.alternate;
                                if (k !== null) {
                                    var E = k.child;
                                    if (E !== null) {
                                        k.child = null;
                                        do {
                                            var O = E.sibling;
                                            E.sibling = null, E = O;
                                        }while (E !== null);
                                    }
                                }
                                N = i;
                            }
                        }
                        if (i.subtreeFlags & 2064 && o !== null) o.return = i, N = o;
                        else e: for(; N !== null;){
                            if (i = N, i.flags & 2048) switch(i.tag){
                                case 0:
                                case 11:
                                case 15:
                                    qn(9, i, i.return);
                            }
                            var f = i.sibling;
                            if (f !== null) {
                                f.return = i.return, N = f;
                                break e;
                            }
                            N = i.return;
                        }
                    }
                    var c = e.current;
                    for(N = c; N !== null;){
                        o = N;
                        var d = o.child;
                        if (o.subtreeFlags & 2064 && d !== null) d.return = o, N = d;
                        else e: for(o = c; N !== null;){
                            if (u = N, u.flags & 2048) try {
                                switch(u.tag){
                                    case 0:
                                    case 11:
                                    case 15:
                                        Il(9, u);
                                }
                            } catch (_) {
                                X(u, u.return, _);
                            }
                            if (u === o) {
                                N = null;
                                break e;
                            }
                            var w = u.sibling;
                            if (w !== null) {
                                w.return = u.return, N = w;
                                break e;
                            }
                            N = u.return;
                        }
                    }
                    if (D = l, Lt(), Ye && typeof Ye.onPostCommitFiberRoot == "function") try {
                        Ye.onPostCommitFiberRoot(Nl, e);
                    } catch  {}
                    r = !0;
                }
                return r;
            } finally{
                A = n, Me.transition = t;
            }
        }
        return !1;
    }
    function cs(e, t, n) {
        t = xn(n, t), t = oc(e, t, 1), e = xt(e, t, 1), t = me(), e !== null && (wr(e, 1, t), Ee(e, t));
    }
    function X(e, t, n) {
        if (e.tag === 3) cs(e, e, n);
        else for(; t !== null;){
            if (t.tag === 3) {
                cs(t, e, n);
                break;
            } else if (t.tag === 1) {
                var r = t.stateNode;
                if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Et === null || !Et.has(r))) {
                    e = xn(n, e), e = uc(t, e, 1), t = xt(t, e, 1), e = me(), t !== null && (wr(t, 1, e), Ee(t, e));
                    break;
                }
            }
            t = t.return;
        }
    }
    function tp(e, t, n) {
        var r = e.pingCache;
        r !== null && r.delete(t), t = me(), e.pingedLanes |= e.suspendedLanes & n, ie === e && (ue & n) === n && (te === 4 || te === 3 && (ue & 130023424) === ue && 500 > q() - qo ? Ut(e, 0) : Xo |= n), Ee(e, t);
    }
    function Tc(e, t) {
        t === 0 && (e.mode & 1 ? (t = Pr, Pr <<= 1, !(Pr & 130023424) && (Pr = 4194304)) : t = 1);
        var n = me();
        e = ot(e, t), e !== null && (wr(e, t, n), Ee(e, n));
    }
    function np(e) {
        var t = e.memoizedState, n = 0;
        t !== null && (n = t.retryLane), Tc(e, n);
    }
    function rp(e, t) {
        var n = 0;
        switch(e.tag){
            case 13:
                var r = e.stateNode, l = e.memoizedState;
                l !== null && (n = l.retryLane);
                break;
            case 19:
                r = e.stateNode;
                break;
            default:
                throw Error(S(314));
        }
        r !== null && r.delete(t), Tc(e, n);
    }
    var Pc;
    Pc = function(e, t, n) {
        if (e !== null) if (e.memoizedProps !== t.pendingProps || ke.current) Se = !0;
        else {
            if (!(e.lanes & n) && !(t.flags & 128)) return Se = !1, Hd(e, t, n);
            Se = !!(e.flags & 131072);
        }
        else Se = !1, H && t.flags & 1048576 && ja(t, pl, t.index);
        switch(t.lanes = 0, t.tag){
            case 2:
                var r = t.type;
                qr(e, t), e = t.pendingProps;
                var l = gn(t, de.current);
                mn(t, n), l = Bo(null, t, r, e, l, n);
                var i = Ho();
                return t.flags |= 1, typeof l == "object" && l !== null && typeof l.render == "function" && l.$$typeof === void 0 ? (t.tag = 1, t.memoizedState = null, t.updateQueue = null, xe(r) ? (i = !0, fl(t)) : i = !1, t.memoizedState = l.state !== null && l.state !== void 0 ? l.state : null, Ao(t), l.updater = zl, t.stateNode = l, l._reactInternals = t, Yi(t, r, e, n), t = Zi(null, t, r, !0, i, n)) : (t.tag = 0, H && i && Fo(t), he(null, t, l, n), t = t.child), t;
            case 16:
                r = t.elementType;
                e: {
                    switch(qr(e, t), e = t.pendingProps, l = r._init, r = l(r._payload), t.type = r, l = t.tag = ip(r), e = Ve(r, e), l){
                        case 0:
                            t = qi(null, t, r, e, n);
                            break e;
                        case 1:
                            t = es(null, t, r, e, n);
                            break e;
                        case 11:
                            t = Ju(null, t, r, e, n);
                            break e;
                        case 14:
                            t = bu(null, t, r, Ve(r.type, e), n);
                            break e;
                    }
                    throw Error(S(306, r, ""));
                }
                return t;
            case 0:
                return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Ve(r, l), qi(e, t, r, l, n);
            case 1:
                return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Ve(r, l), es(e, t, r, l, n);
            case 3:
                e: {
                    if (fc(t), e === null) throw Error(S(387));
                    r = t.pendingProps, i = t.memoizedState, l = i.element, Aa(e, t), vl(t, r, null, n);
                    var o = t.memoizedState;
                    if (r = o.element, i.isDehydrated) if (i = {
                        element: r,
                        isDehydrated: !1,
                        cache: o.cache,
                        pendingSuspenseBoundaries: o.pendingSuspenseBoundaries,
                        transitions: o.transitions
                    }, t.updateQueue.baseState = i, t.memoizedState = i, t.flags & 256) {
                        l = xn(Error(S(423)), t), t = ts(e, t, r, n, l);
                        break e;
                    } else if (r !== l) {
                        l = xn(Error(S(424)), t), t = ts(e, t, r, n, l);
                        break e;
                    } else for(Ce = kt(t.stateNode.containerInfo.firstChild), Ne = t, H = !0, We = null, n = Oa(t, null, r, n), t.child = n; n;)n.flags = n.flags & -3 | 4096, n = n.sibling;
                    else {
                        if (wn(), r === l) {
                            t = ut(e, t, n);
                            break e;
                        }
                        he(e, t, r, n);
                    }
                    t = t.child;
                }
                return t;
            case 5:
                return Va(t), e === null && Qi(t), r = t.type, l = t.pendingProps, i = e !== null ? e.memoizedProps : null, o = l.children, Ui(r, l) ? o = null : i !== null && Ui(r, i) && (t.flags |= 32), cc(e, t), he(e, t, o, n), t.child;
            case 6:
                return e === null && Qi(t), null;
            case 13:
                return dc(e, t, n);
            case 4:
                return Vo(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = Sn(t, null, r, n) : he(e, t, r, n), t.child;
            case 11:
                return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Ve(r, l), Ju(e, t, r, l, n);
            case 7:
                return he(e, t, t.pendingProps, n), t.child;
            case 8:
                return he(e, t, t.pendingProps.children, n), t.child;
            case 12:
                return he(e, t, t.pendingProps.children, n), t.child;
            case 10:
                e: {
                    if (r = t.type._context, l = t.pendingProps, i = t.memoizedProps, o = l.value, V(hl, r._currentValue), r._currentValue = o, i !== null) if (He(i.value, o)) {
                        if (i.children === l.children && !ke.current) {
                            t = ut(e, t, n);
                            break e;
                        }
                    } else for(i = t.child, i !== null && (i.return = t); i !== null;){
                        var u = i.dependencies;
                        if (u !== null) {
                            o = i.child;
                            for(var s = u.firstContext; s !== null;){
                                if (s.context === r) {
                                    if (i.tag === 1) {
                                        s = rt(-1, n & -n), s.tag = 2;
                                        var a = i.updateQueue;
                                        if (a !== null) {
                                            a = a.shared;
                                            var v = a.pending;
                                            v === null ? s.next = s : (s.next = v.next, v.next = s), a.pending = s;
                                        }
                                    }
                                    i.lanes |= n, s = i.alternate, s !== null && (s.lanes |= n), Gi(i.return, n, t), u.lanes |= n;
                                    break;
                                }
                                s = s.next;
                            }
                        } else if (i.tag === 10) o = i.type === t.type ? null : i.child;
                        else if (i.tag === 18) {
                            if (o = i.return, o === null) throw Error(S(341));
                            o.lanes |= n, u = o.alternate, u !== null && (u.lanes |= n), Gi(o, n, t), o = i.sibling;
                        } else o = i.child;
                        if (o !== null) o.return = i;
                        else for(o = i; o !== null;){
                            if (o === t) {
                                o = null;
                                break;
                            }
                            if (i = o.sibling, i !== null) {
                                i.return = o.return, o = i;
                                break;
                            }
                            o = o.return;
                        }
                        i = o;
                    }
                    he(e, t, l.children, n), t = t.child;
                }
                return t;
            case 9:
                return l = t.type, r = t.pendingProps.children, mn(t, n), l = Oe(l), r = r(l), t.flags |= 1, he(e, t, r, n), t.child;
            case 14:
                return r = t.type, l = Ve(r, t.pendingProps), l = Ve(r.type, l), bu(e, t, r, l, n);
            case 15:
                return sc(e, t, t.type, t.pendingProps, n);
            case 17:
                return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : Ve(r, l), qr(e, t), t.tag = 1, xe(r) ? (e = !0, fl(t)) : e = !1, mn(t, n), ic(t, r, l), Yi(t, r, l, n), Zi(null, t, r, !0, e, n);
            case 19:
                return pc(e, t, n);
            case 22:
                return ac(e, t, n);
        }
        throw Error(S(156, t.tag));
    };
    function Rc(e, t) {
        return na(e, t);
    }
    function lp(e, t, n, r) {
        this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
    }
    function Ie(e, t, n, r) {
        return new lp(e, t, n, r);
    }
    function eu(e) {
        return e = e.prototype, !(!e || !e.isReactComponent);
    }
    function ip(e) {
        if (typeof e == "function") return eu(e) ? 1 : 0;
        if (e != null) {
            if (e = e.$$typeof, e === wo) return 11;
            if (e === So) return 14;
        }
        return 2;
    }
    function Ct(e, t) {
        var n = e.alternate;
        return n === null ? (n = Ie(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 14680064, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
            lanes: t.lanes,
            firstContext: t.firstContext
        }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n;
    }
    function br(e, t, n, r, l, i) {
        var o = 2;
        if (r = e, typeof e == "function") eu(e) && (o = 1);
        else if (typeof e == "string") o = 5;
        else e: switch(e){
            case bt:
                return Wt(n.children, l, i, t);
            case go:
                o = 8, l |= 8;
                break;
            case gi:
                return e = Ie(12, n, t, l | 2), e.elementType = gi, e.lanes = i, e;
            case wi:
                return e = Ie(13, n, t, l), e.elementType = wi, e.lanes = i, e;
            case Si:
                return e = Ie(19, n, t, l), e.elementType = Si, e.lanes = i, e;
            case Vs:
                return Ol(n, l, i, t);
            default:
                if (typeof e == "object" && e !== null) switch(e.$$typeof){
                    case Ds:
                        o = 10;
                        break e;
                    case As:
                        o = 9;
                        break e;
                    case wo:
                        o = 11;
                        break e;
                    case So:
                        o = 14;
                        break e;
                    case dt:
                        o = 16, r = null;
                        break e;
                }
                throw Error(S(130, e == null ? e : typeof e, ""));
        }
        return t = Ie(o, n, t, l), t.elementType = e, t.type = r, t.lanes = i, t;
    }
    function Wt(e, t, n, r) {
        return e = Ie(7, e, r, t), e.lanes = n, e;
    }
    function Ol(e, t, n, r) {
        return e = Ie(22, e, r, t), e.elementType = Vs, e.lanes = n, e.stateNode = {
            isHidden: !1
        }, e;
    }
    function fi(e, t, n) {
        return e = Ie(6, e, null, t), e.lanes = n, e;
    }
    function di(e, t, n) {
        return t = Ie(4, e.children !== null ? e.children : [], e.key, t), t.lanes = n, t.stateNode = {
            containerInfo: e.containerInfo,
            pendingChildren: null,
            implementation: e.implementation
        }, t;
    }
    function op(e, t, n, r, l) {
        this.tag = t, this.containerInfo = e, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Gl(0), this.expirationTimes = Gl(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Gl(0), this.identifierPrefix = r, this.onRecoverableError = l, this.mutableSourceEagerHydrationData = null;
    }
    function tu(e, t, n, r, l, i, o, u, s) {
        return e = new op(e, t, n, u, s), t === 1 ? (t = 1, i === !0 && (t |= 8)) : t = 0, i = Ie(3, null, null, t), e.current = i, i.stateNode = e, i.memoizedState = {
            element: r,
            isDehydrated: n,
            cache: null,
            transitions: null,
            pendingSuspenseBoundaries: null
        }, Ao(i), e;
    }
    function up(e, t, n) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
            $$typeof: Jt,
            key: r == null ? null : "" + r,
            children: e,
            containerInfo: t,
            implementation: n
        };
    }
    function Lc(e) {
        if (!e) return Tt;
        e = e._reactInternals;
        e: {
            if (Yt(e) !== e || e.tag !== 1) throw Error(S(170));
            var t = e;
            do {
                switch(t.tag){
                    case 3:
                        t = t.stateNode.context;
                        break e;
                    case 1:
                        if (xe(t.type)) {
                            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
                            break e;
                        }
                }
                t = t.return;
            }while (t !== null);
            throw Error(S(171));
        }
        if (e.tag === 1) {
            var n = e.type;
            if (xe(n)) return La(e, n, t);
        }
        return t;
    }
    function Fc(e, t, n, r, l, i, o, u, s) {
        return e = tu(n, r, !0, e, l, i, o, u, s), e.context = Lc(null), n = e.current, r = me(), l = _t(n), i = rt(r, l), i.callback = t ?? null, xt(n, i, l), e.current.lanes = l, wr(e, l, r), Ee(e, r), e;
    }
    function Dl(e, t, n, r) {
        var l = t.current, i = me(), o = _t(l);
        return n = Lc(n), t.context === null ? t.context = n : t.pendingContext = n, t = rt(i, o), t.payload = {
            element: e
        }, r = r === void 0 ? null : r, r !== null && (t.callback = r), e = xt(l, t, o), e !== null && (Be(e, l, o, i), Kr(e, l, o)), o;
    }
    function _l(e) {
        if (e = e.current, !e.child) return null;
        switch(e.child.tag){
            case 5:
                return e.child.stateNode;
            default:
                return e.child.stateNode;
        }
    }
    function fs(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
            var n = e.retryLane;
            e.retryLane = n !== 0 && n < t ? n : t;
        }
    }
    function nu(e, t) {
        fs(e, t), (e = e.alternate) && fs(e, t);
    }
    function sp() {
        return null;
    }
    var jc = typeof reportError == "function" ? reportError : function(e) {
        console.error(e);
    };
    function ru(e) {
        this._internalRoot = e;
    }
    Al.prototype.render = ru.prototype.render = function(e) {
        var t = this._internalRoot;
        if (t === null) throw Error(S(409));
        Dl(e, t, null, null);
    };
    Al.prototype.unmount = ru.prototype.unmount = function() {
        var e = this._internalRoot;
        if (e !== null) {
            this._internalRoot = null;
            var t = e.containerInfo;
            Gt(function() {
                Dl(null, e, null, null);
            }), t[it] = null;
        }
    };
    function Al(e) {
        this._internalRoot = e;
    }
    Al.prototype.unstable_scheduleHydration = function(e) {
        if (e) {
            var t = aa();
            e = {
                blockedOn: null,
                target: e,
                priority: t
            };
            for(var n = 0; n < ht.length && t !== 0 && t < ht[n].priority; n++);
            ht.splice(n, 0, e), n === 0 && fa(e);
        }
    };
    function lu(e) {
        return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
    }
    function Vl(e) {
        return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11 && (e.nodeType !== 8 || e.nodeValue !== " react-mount-point-unstable "));
    }
    function ds() {}
    function ap(e, t, n, r, l) {
        if (l) {
            if (typeof r == "function") {
                var i = r;
                r = function() {
                    var a = _l(o);
                    i.call(a);
                };
            }
            var o = Fc(t, r, e, 0, null, !1, !1, "", ds);
            return e._reactRootContainer = o, e[it] = o.current, sr(e.nodeType === 8 ? e.parentNode : e), Gt(), o;
        }
        for(; l = e.lastChild;)e.removeChild(l);
        if (typeof r == "function") {
            var u = r;
            r = function() {
                var a = _l(s);
                u.call(a);
            };
        }
        var s = tu(e, 0, !1, null, null, !1, !1, "", ds);
        return e._reactRootContainer = s, e[it] = s.current, sr(e.nodeType === 8 ? e.parentNode : e), Gt(function() {
            Dl(t, s, n, r);
        }), s;
    }
    function Ul(e, t, n, r, l) {
        var i = n._reactRootContainer;
        if (i) {
            var o = i;
            if (typeof l == "function") {
                var u = l;
                l = function() {
                    var s = _l(o);
                    u.call(s);
                };
            }
            Dl(t, o, e, l);
        } else o = ap(n, t, e, l, r);
        return _l(o);
    }
    ua = function(e) {
        switch(e.tag){
            case 3:
                var t = e.stateNode;
                if (t.current.memoizedState.isDehydrated) {
                    var n = Un(t.pendingLanes);
                    n !== 0 && (Eo(t, n | 1), Ee(t, q()), !(D & 6) && (En = q() + 500, Lt()));
                }
                break;
            case 13:
                Gt(function() {
                    var r = ot(e, 1);
                    if (r !== null) {
                        var l = me();
                        Be(r, e, 1, l);
                    }
                }), nu(e, 1);
        }
    };
    _o = function(e) {
        if (e.tag === 13) {
            var t = ot(e, 134217728);
            if (t !== null) {
                var n = me();
                Be(t, e, 134217728, n);
            }
            nu(e, 134217728);
        }
    };
    sa = function(e) {
        if (e.tag === 13) {
            var t = _t(e), n = ot(e, t);
            if (n !== null) {
                var r = me();
                Be(n, e, t, r);
            }
            nu(e, t);
        }
    };
    aa = function() {
        return A;
    };
    ca = function(e, t) {
        var n = A;
        try {
            return A = e, t();
        } finally{
            A = n;
        }
    };
    Li = function(e, t, n) {
        switch(t){
            case "input":
                if (Ei(e, n), t = n.name, n.type === "radio" && t != null) {
                    for(n = e; n.parentNode;)n = n.parentNode;
                    for(n = n.querySelectorAll("input[name=" + JSON.stringify("" + t) + '][type="radio"]'), t = 0; t < n.length; t++){
                        var r = n[t];
                        if (r !== e && r.form === e.form) {
                            var l = Ll(r);
                            if (!l) throw Error(S(90));
                            Ws(r), Ei(r, l);
                        }
                    }
                }
                break;
            case "textarea":
                Bs(e, n);
                break;
            case "select":
                t = n.value, t != null && fn(e, !!n.multiple, t, !1);
        }
    };
    qs = Zo;
    Zs = Gt;
    var cp = {
        usingClientEntryPoint: !1,
        Events: [
            kr,
            rn,
            Ll,
            Ys,
            Xs,
            Zo
        ]
    }, Dn = {
        findFiberByHostInstance: Dt,
        bundleType: 0,
        version: "18.3.1",
        rendererPackageName: "react-dom"
    }, fp = {
        bundleType: Dn.bundleType,
        version: Dn.version,
        rendererPackageName: Dn.rendererPackageName,
        rendererConfig: Dn.rendererConfig,
        overrideHookState: null,
        overrideHookStateDeletePath: null,
        overrideHookStateRenamePath: null,
        overrideProps: null,
        overridePropsDeletePath: null,
        overridePropsRenamePath: null,
        setErrorHandler: null,
        setSuspenseHandler: null,
        scheduleUpdate: null,
        currentDispatcherRef: st.ReactCurrentDispatcher,
        findHostInstanceByFiber: function(e) {
            return e = ea(e), e === null ? null : e.stateNode;
        },
        findFiberByHostInstance: Dn.findFiberByHostInstance || sp,
        findHostInstancesForRefresh: null,
        scheduleRefresh: null,
        scheduleRoot: null,
        setRefreshHandler: null,
        getCurrentFiber: null,
        reconcilerVersion: "18.3.1-next-f1338f8080-20240426"
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
        var Vr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!Vr.isDisabled && Vr.supportsFiber) try {
            Nl = Vr.inject(fp), Ye = Vr;
        } catch  {}
    }
    Pe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = cp;
    Pe.createPortal = function(e, t) {
        var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
        if (!lu(t)) throw Error(S(200));
        return up(e, t, null, n);
    };
    Pe.createRoot = function(e, t) {
        if (!lu(e)) throw Error(S(299));
        var n = !1, r = "", l = jc;
        return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onRecoverableError !== void 0 && (l = t.onRecoverableError)), t = tu(e, 1, !1, null, null, n, !1, r, l), e[it] = t.current, sr(e.nodeType === 8 ? e.parentNode : e), new ru(t);
    };
    Pe.findDOMNode = function(e) {
        if (e == null) return null;
        if (e.nodeType === 1) return e;
        var t = e._reactInternals;
        if (t === void 0) throw typeof e.render == "function" ? Error(S(188)) : (e = Object.keys(e).join(","), Error(S(268, e)));
        return e = ea(t), e = e === null ? null : e.stateNode, e;
    };
    Pe.flushSync = function(e) {
        return Gt(e);
    };
    Pe.hydrate = function(e, t, n) {
        if (!Vl(t)) throw Error(S(200));
        return Ul(null, e, t, !0, n);
    };
    Pe.hydrateRoot = function(e, t, n) {
        if (!lu(e)) throw Error(S(405));
        var r = n != null && n.hydratedSources || null, l = !1, i = "", o = jc;
        if (n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (i = n.identifierPrefix), n.onRecoverableError !== void 0 && (o = n.onRecoverableError)), t = Fc(t, null, e, 1, n ?? null, l, !1, i, o), e[it] = t.current, sr(e), r) for(e = 0; e < r.length; e++)n = r[e], l = n._getVersion, l = l(n._source), t.mutableSourceEagerHydrationData == null ? t.mutableSourceEagerHydrationData = [
            n,
            l
        ] : t.mutableSourceEagerHydrationData.push(n, l);
        return new Al(t);
    };
    Pe.render = function(e, t, n) {
        if (!Vl(t)) throw Error(S(200));
        return Ul(null, e, t, !1, n);
    };
    Pe.unmountComponentAtNode = function(e) {
        if (!Vl(e)) throw Error(S(40));
        return e._reactRootContainer ? (Gt(function() {
            Ul(null, null, e, !1, function() {
                e._reactRootContainer = null, e[it] = null;
            });
        }), !0) : !1;
    };
    Pe.unstable_batchedUpdates = Zo;
    Pe.unstable_renderSubtreeIntoContainer = function(e, t, n, r) {
        if (!Vl(n)) throw Error(S(200));
        if (e == null || e._reactInternals === void 0) throw Error(S(38));
        return Ul(e, t, n, !1, r);
    };
    Pe.version = "18.3.1-next-f1338f8080-20240426";
    function zc() {
        if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(zc);
        } catch (e) {
            console.error(e);
        }
    }
    zc(), zs.exports = Pe;
    var dp = zs.exports, ps = dp;
    vi.createRoot = ps.createRoot, vi.hydrateRoot = ps.hydrateRoot;
    let Z;
    const Ic = typeof TextDecoder < "u" ? new TextDecoder("utf-8", {
        ignoreBOM: !0,
        fatal: !0
    }) : {
        decode: ()=>{
            throw Error("TextDecoder not available");
        }
    };
    typeof TextDecoder < "u" && Ic.decode();
    let $n = null;
    function bn() {
        return ($n === null || $n.byteLength === 0) && ($n = new Uint8Array(Z.memory.buffer)), $n;
    }
    function hs(e, t) {
        return e = e >>> 0, Ic.decode(bn().subarray(e, e + t));
    }
    let yr = 0;
    const el = typeof TextEncoder < "u" ? new TextEncoder("utf-8") : {
        encode: ()=>{
            throw Error("TextEncoder not available");
        }
    }, pp = typeof el.encodeInto == "function" ? function(e, t) {
        return el.encodeInto(e, t);
    } : function(e, t) {
        const n = el.encode(e);
        return t.set(n), {
            read: e.length,
            written: n.length
        };
    };
    function hp(e, t, n) {
        if (n === void 0) {
            const u = el.encode(e), s = t(u.length, 1) >>> 0;
            return bn().subarray(s, s + u.length).set(u), yr = u.length, s;
        }
        let r = e.length, l = t(r, 1) >>> 0;
        const i = bn();
        let o = 0;
        for(; o < r; o++){
            const u = e.charCodeAt(o);
            if (u > 127) break;
            i[l + o] = u;
        }
        if (o !== r) {
            o !== 0 && (e = e.slice(o)), l = n(l, r, r = o + e.length * 3, 1) >>> 0;
            const u = bn().subarray(l + o, l + r), s = pp(e, u);
            o += s.written, l = n(l, r, o, 1) >>> 0;
        }
        return yr = o, l;
    }
    let Mt = null;
    function ms() {
        return (Mt === null || Mt.buffer.detached === !0 || Mt.buffer.detached === void 0 && Mt.buffer !== Z.memory.buffer) && (Mt = new DataView(Z.memory.buffer)), Mt;
    }
    function mp(e, t) {
        return e = e >>> 0, bn().subarray(e / 1, e / 1 + t);
    }
    let Bn = null;
    function Mc() {
        return (Bn === null || Bn.byteLength === 0) && (Bn = new Float32Array(Z.memory.buffer)), Bn;
    }
    function vp(e, t) {
        const n = t(e.length * 4, 4) >>> 0;
        return Mc().set(e, n / 4), yr = e.length, n;
    }
    function Oc(e, t) {
        return e = e >>> 0, Mc().subarray(e / 4, e / 4 + t);
    }
    function vs(e, t, n, r, l) {
        const i = Z.wasm_generate_waveform_with_phase(e, t, n, r, l);
        var o = Oc(i[0], i[1]).slice();
        return Z.__wbindgen_free(i[0], i[1] * 4, 4), o;
    }
    function yp(e, t, n, r, l) {
        const i = Z.wasm_fm_waveform(e, t, n, r, l);
        var o = Oc(i[0], i[1]).slice();
        return Z.__wbindgen_free(i[0], i[1] * 4, 4), o;
    }
    function gp(e, t, n, r, l, i) {
        var o = vp(e, Z.__wbindgen_malloc), u = yr;
        Z.wasm_apply_adsr(o, u, e, t, n, r, l, i);
    }
    const Ur = Object.freeze({
        Sine: 0,
        0: "Sine",
        Sawtooth: 1,
        1: "Sawtooth",
        Square: 2,
        2: "Square",
        Triangle: 3,
        3: "Triangle"
    });
    typeof FinalizationRegistry > "u" || new FinalizationRegistry((e)=>Z.__wbg_adsr_free(e >>> 0, 1));
    typeof FinalizationRegistry > "u" || new FinalizationRegistry((e)=>Z.__wbg_dspchain_free(e >>> 0, 1));
    async function wp(e, t) {
        if (typeof Response == "function" && e instanceof Response) {
            if (typeof WebAssembly.instantiateStreaming == "function") try {
                return await WebAssembly.instantiateStreaming(e, t);
            } catch (r) {
                if (e.headers.get("Content-Type") != "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", r);
                else throw r;
            }
            const n = await e.arrayBuffer();
            return await WebAssembly.instantiate(n, t);
        } else {
            const n = await WebAssembly.instantiate(e, t);
            return n instanceof WebAssembly.Instance ? {
                instance: n,
                module: e
            } : n;
        }
    }
    function Sp() {
        const e = {};
        return e.wbg = {}, e.wbg.__wbg_error_7534b8e9a36f1ab4 = function(t, n) {
            let r, l;
            try {
                r = t, l = n, console.error(hs(t, n));
            } finally{
                Z.__wbindgen_free(r, l, 1);
            }
        }, e.wbg.__wbg_new_8a6f238a6ece86ea = function() {
            return new Error;
        }, e.wbg.__wbg_stack_0ed75d68575b0f3c = function(t, n) {
            const r = n.stack, l = hp(r, Z.__wbindgen_malloc, Z.__wbindgen_realloc), i = yr;
            ms().setInt32(t + 4 * 1, i, !0), ms().setInt32(t + 4 * 0, l, !0);
        }, e.wbg.__wbindgen_copy_to_typed_array = function(t, n, r) {
            new Uint8Array(r.buffer, r.byteOffset, r.byteLength).set(mp(t, n));
        }, e.wbg.__wbindgen_init_externref_table = function() {
            const t = Z.__wbindgen_export_3, n = t.grow(4);
            t.set(0, void 0), t.set(n + 0, void 0), t.set(n + 1, null), t.set(n + 2, !0), t.set(n + 3, !1);
        }, e.wbg.__wbindgen_throw = function(t, n) {
            throw new Error(hs(t, n));
        }, e;
    }
    function kp(e, t) {
        return Z = e.exports, Dc.__wbindgen_wasm_module = t, Mt = null, Bn = null, $n = null, Z.__wbindgen_start(), Z;
    }
    async function Dc(e) {
        if (Z !== void 0) return Z;
        typeof e < "u" && (Object.getPrototypeOf(e) === Object.prototype ? { module_or_path: e } = e : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), typeof e > "u" && (e = new URL("/pkg/sound_engine_bg.wasm", import.meta.url));
        const t = Sp();
        (typeof e == "string" || typeof Request == "function" && e instanceof Request || typeof URL == "function" && e instanceof URL) && (e = fetch(e));
        const { instance: n, module: r } = await wp(await e, t);
        return kp(n, r);
    }
    const ao = 44100, Wr = 1, xp = 512, Ep = xp, _p = 32, Cp = 96, et = .01, Zt = 1e-4, ys = .018, Ot = Object.freeze({
        IDLE: "idle",
        STARTING: "starting",
        PLAYING: "playing",
        STOPPING: "stopping"
    }), Np = [
        "C3",
        "C4",
        "C5",
        "C6"
    ], Tp = [
        "Sine",
        "Square",
        "Sawtooth",
        "Triangle"
    ], Pp = [
        "pointerdown",
        "touchstart",
        "mousedown",
        "keydown"
    ], Rp = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B"
    ], Lp = -1, Fp = 7, jp = {
        C: -9,
        "C#": -8,
        D: -7,
        "D#": -6,
        E: -5,
        F: -4,
        "F#": -3,
        G: -2,
        "G#": -1,
        A: 0,
        "A#": 1,
        B: 2
    };
    function re(e, t, n) {
        return Math.min(Math.max(e, t), n);
    }
    function gs(e) {
        switch(e){
            case "Square":
                return Ur.Square;
            case "Sawtooth":
                return Ur.Sawtooth;
            case "Triangle":
                return Ur.Triangle;
            case "Sine":
            default:
                return Ur.Sine;
        }
    }
    class zp {
        constructor(t = ao, n = Cp){
            this.blockSize = t, this.maxBlocks = n, this.pool = [];
        }
        acquire(t) {
            const n = Math.max(t, this.blockSize);
            for(let r = 0; r < this.pool.length; r += 1){
                const l = this.pool[r];
                if (l.length >= n) return this.pool.splice(r, 1), l;
            }
            return new Float32Array(n);
        }
        release(t) {
            !t || this.pool.length >= this.maxBlocks || this.pool.push(t);
        }
    }
    class Ip {
        constructor(t = 44100){
            this.resolution = t, this.cache = new Map;
        }
        get(t) {
            const n = re(t ?? 0, 0, 1), r = Math.round(n * 1e3) / 1e3;
            if (this.cache.has(r)) return this.cache.get(r);
            const l = new Float32Array(this.resolution);
            if (r === 0) {
                for(let u = 0; u < this.resolution; u += 1)l[u] = u * 2 / this.resolution - 1;
                return this.cache.set(r, l), l;
            }
            const i = r * 150, o = Math.PI / 180;
            for(let u = 0; u < this.resolution; u += 1){
                const s = u * 2 / this.resolution - 1;
                l[u] = (3 + i) * s * 20 * o / (Math.PI + i * Math.abs(s));
            }
            return this.cache.set(r, l), l;
        }
    }
    class Mp {
        constructor(t, n, r){
            this.engine = t, this.ctx = n, this.target = r, this.gain = n.createGain(), this.gain.gain.value = 0, this.gain.connect(r), this.bufferSource = null, this.playingSource = null, this.stopSource = null, this.noteId = null, this.active = !1, this.startTime = 0, this.state = Ot.IDLE, this.lastStopTime = 0, this.prepareNextSource();
        }
        prepareNextSource() {
            this.bufferSource = this.ctx.createBufferSource(), this.bufferSource.connect(this.gain);
        }
        trigger({ buffer: t, noteId: n, volume: r, attackTime: l, startTime: i }) {
            const o = this.bufferSource;
            o.buffer = t, o.loop = !1, this.stopSource = o.stop.bind(o), o.stop = (g)=>{
                this.stop(g);
            }, o.onended = ()=>{
                this.playingSource === o && this.cleanup();
            };
            const u = this.ctx, s = Math.max(i, this.lastStopTime, u.currentTime);
            this.playingSource = o, this.noteId = n, this.active = !0, this.startTime = s, this.state = Ot.STARTING;
            const a = this.gain.gain, v = Math.max(l, et), m = Math.max(r, Zt), p = Math.max(Zt, a.value || Zt);
            a.cancelScheduledValues(s), a.setValueAtTime(p, s), v > 0 ? a.exponentialRampToValueAtTime(m, s + v) : a.setValueAtTime(m, s), a.setTargetAtTime(m, s + v, .001);
            try {
                o.start(s), this.state = Ot.PLAYING;
            } catch  {
                this.cleanup();
            }
            return this.prepareNextSource(), o;
        }
        stop(t = this.ctx.currentTime) {
            if (!this.active || !this.playingSource || this.state === Ot.STOPPING) return;
            const n = this.ctx, r = Math.max(t, n.currentTime), l = this.gain.gain, i = Math.max(l.value || Zt, Zt);
            if (this.state = Ot.STOPPING, l.cancelScheduledValues(r), l.setValueAtTime(i, r), l.exponentialRampToValueAtTime(Zt, r + et), l.setValueAtTime(0, r + et + ys), this.stopSource) try {
                const o = r + et + ys;
                this.stopSource(o), this.lastStopTime = o;
            } catch  {}
            else this.lastStopTime = Math.max(this.lastStopTime, r);
        }
        cleanup() {
            if (!this.active) return;
            this.active = !1, this.noteId = null, this.playingSource = null, this.stopSource = null, this.state = Ot.IDLE;
            const t = this.ctx.currentTime;
            this.gain.gain.cancelScheduledValues(t), this.gain.gain.setValueAtTime(0, t), this.lastStopTime = Math.max(this.lastStopTime, t), this.engine.recycleVoice(this);
        }
    }
    class Op {
        constructor(){
            this.wasmReady = !1, this.wasmInitPromise = null, this.context = null, this.contextPromise = null, this.graphReady = !1, this.graphWarmPromise = null, this.unlockHandlerInstalled = !1, this.statusListeners = new Set, this.status = {
                wasmReady: !1,
                contextReady: !1,
                graphWarmed: !1
            }, this.silentBuffer = null, this.cachedImpulse = null, this.globalNodes = null, this.currentParams = null, this.lastParamSignature = "", this.voices = [], this.freeVoices = [], this.activeVoices = new Map, this.voiceSerial = 0, this.floatPool = new zp, this.distortionCache = new Ip, this.waveformCache = new Map, this.frequencyTable = this.buildFrequencyTable(), this.commonWaveformsPrecomputed = !1;
        }
        subscribe(t) {
            return this.statusListeners.add(t), ()=>this.statusListeners.delete(t);
        }
        notify() {
            const t = this.getStatus();
            for (const n of this.statusListeners)n(t);
        }
        markGraphReady() {
            this.graphReady || (this.graphReady = !0, this.status.graphWarmed = !0, this.notify());
        }
        getStatus() {
            return {
                ...this.status
            };
        }
        async ensureWasm() {
            return this.wasmInitPromise || (this.wasmInitPromise = Dc().then((t)=>(this.wasmReady = !0, this.status.wasmReady = !0, this.notify(), this.precomputeCommonWaveforms(), t))), this.wasmInitPromise;
        }
        async ensureAudioContext() {
            return this.contextPromise ? this.contextPromise : (this.contextPromise = Promise.resolve().then(()=>{
                let t;
                try {
                    t = new (window.AudioContext || window.webkitAudioContext)({
                        latencyHint: "interactive",
                        sampleRate: ao
                    });
                } catch  {
                    t = new (window.AudioContext || window.webkitAudioContext);
                }
                return this.context = t, this.status.contextReady = !0, this.notify(), this.installUnlockHandlers(), this.setupGraph(t), this.ensureVoicePool(t), t.state === "running" && this.markGraphReady(), t;
            }), this.contextPromise);
        }
        installUnlockHandlers() {
            if (this.unlockHandlerInstalled || typeof window > "u") return;
            const t = async ()=>{
                if (this.context) {
                    if (this.context.state === "suspended") try {
                        await this.context.resume();
                    } catch  {}
                    this.context.state === "running" && this.markGraphReady();
                }
            };
            Pp.forEach((n)=>{
                window.addEventListener(n, t, {
                    passive: !0
                });
            }), this.unlockHandlerInstalled = !0;
        }
        async warmGraph() {
            return this.graphWarmPromise ? this.graphWarmPromise : (this.graphWarmPromise = (async ()=>{
                await this.ensureWasm();
                const t = await this.ensureAudioContext(), n = this.setupGraph(t);
                this.ensureSilentBuffer(t);
                try {
                    const r = t.createBufferSource();
                    r.buffer = this.silentBuffer, r.connect(n.inputBus), r.start(), r.stop(t.currentTime + .05);
                } catch  {}
                this.markGraphReady();
            })().catch(()=>{
                this.graphWarmPromise = null;
            }), this.graphWarmPromise);
        }
        ensureSilentBuffer(t) {
            if (this.silentBuffer) return;
            this.silentBuffer = t.createBuffer(1, Ep, t.sampleRate), this.silentBuffer.getChannelData(0).fill(0);
        }
        setupGraph(t) {
            if (this.globalNodes) return this.globalNodes;
            const n = t.createGain();
            n.gain.value = 1;
            const r = t.createGain(), l = t.createDynamicsCompressor();
            l.threshold.value = -18, l.knee.value = 24, l.ratio.value = 4, l.attack.value = .003, l.release.value = .1;
            const i = t.createWaveShaper();
            i.curve = this.distortionCache.get(0), i.oversample = "4x";
            const o = t.createDelay(5);
            o.delayTime.value = 0;
            const u = t.createGain();
            u.gain.value = 0;
            const s = t.createGain();
            s.gain.value = .7;
            const a = t.createConvolver(), v = t.createGain();
            v.gain.value = 0;
            const m = t.createStereoPanner(), p = t.createAnalyser();
            return p.fftSize = 1024, p.smoothingTimeConstant = .8, this.ensureImpulse(t, a), n.connect(r), r.connect(l), l.connect(i), i.connect(o), i.connect(s), o.connect(u), u.connect(o), o.connect(s), n.connect(a), a.connect(v), v.connect(s), s.connect(m), m.connect(p), p.connect(t.destination), this.globalNodes = {
                inputBus: n,
                dryGain: r,
                compressor: l,
                distortion: i,
                delayNode: o,
                delayFeedback: u,
                reverbNode: a,
                reverbGain: v,
                masterGain: s,
                stereoPanner: m,
                analyser: p
            }, this.globalNodes;
        }
        ensureImpulse(t, n) {
            if (this.cachedImpulse) {
                n.buffer = this.cachedImpulse;
                return;
            }
            const r = 1.4, l = 2, i = t.sampleRate * r, o = t.createBuffer(l, i, t.sampleRate);
            for(let u = 0; u < l; u += 1){
                const s = o.getChannelData(u);
                for(let a = 0; a < i; a += 1)s[a] = (Math.random() * 2 - 1) * Math.pow(1 - a / i, 2);
            }
            this.cachedImpulse = o, n.buffer = o;
        }
        ensureVoicePool(t) {
            if (this.voices.length) return;
            const n = this.setupGraph(t);
            for(let r = 0; r < _p; r += 1){
                const l = new Mp(this, t, n.inputBus);
                this.voices.push(l), this.freeVoices.push(l);
            }
        }
        acquireVoice(t) {
            if (!this.freeVoices.length) {
                const r = this.stealVoice();
                return r ? (this.activeVoices.set(t, r), r.noteId = t, r) : null;
            }
            const n = this.freeVoices.pop();
            return this.activeVoices.set(t, n), n.noteId = t, n;
        }
        recycleVoice(t) {
            t.noteId && this.activeVoices.get(t.noteId) === t && this.activeVoices.delete(t.noteId), this.freeVoices.includes(t) || this.freeVoices.push(t);
        }
        stealVoice() {
            if (!this.voices.length || !this.context) return null;
            let t = null;
            for (const n of this.voices){
                if (!n.active || n.state === Ot.IDLE) {
                    t = n;
                    break;
                }
                (!t || n.startTime < t.startTime) && (t = n);
            }
            return t && (t.stop(this.context.currentTime), t.noteId && this.activeVoices.delete(t.noteId)), t;
        }
        buildFrequencyTable() {
            const t = new Map;
            for(let n = Lp; n <= Fp; n += 1)for (const r of Rp){
                const l = (n - 4) * 12 + jp[r], i = 440 * Math.pow(2, l / 12);
                t.set(`${r}${n}`, i);
            }
            return t;
        }
        getFrequency(t, n) {
            return this.frequencyTable.get(`${t}${n}`) || null;
        }
        buildWaveformKey({ waveformType: t, frequency: n, duration: r, phaseOffset: l, useFM: i, fmRatio: o, fmIndex: u, sampleRate: s }) {
            return [
                t,
                s,
                r.toFixed(3),
                n.toFixed(3),
                l.toFixed(3),
                i ? 1 : 0,
                o.toFixed(3),
                u.toFixed(3)
            ].join(":");
        }
        fetchWaveformSamples(t) {
            const n = this.buildWaveformKey(t);
            if (this.waveformCache.has(n)) return this.waveformCache.get(n);
            const { waveformType: r, frequency: l, duration: i, phaseOffset: o, useFM: u, fmRatio: s, fmIndex: a, sampleRate: v } = t;
            let m;
            if (u) {
                const p = Math.max(l, 0), g = re(s ?? 2.5, .1, 10), k = p * g, E = re(a ?? 5, 0, 100);
                m = yp(p, k, E, i, v);
            } else {
                const p = gs(r), g = re(o ?? 0, 0, Math.PI * 2);
                m = vs(p, l, g, i, v);
            }
            return this.waveformCache.set(n, m), m;
        }
        applyEnvelopeIfNeeded(t, n, r) {
            if (!n.useADSR) return {
                data: t,
                releaseAfterUse: !1
            };
            const l = re(n.attack ?? .05, et, 5), i = re(n.decay ?? .1, 0, 5), o = re(n.sustain ?? .7, 0, 1), u = re(n.release ?? .3, et, 5), s = this.floatPool.acquire(t.length);
            return s.set(t), gp(s, l, i, o, u, r), {
                data: s,
                releaseAfterUse: !0
            };
        }
        sanitizeParams(t) {
            return {
                volume: re(t.volume ?? .7, 0, 1),
                delay: re(t.delay ?? 0, 0, 500),
                reverb: re(t.reverb ?? 0, 0, 1),
                distortion: re(t.distortion ?? 0, 0, 1),
                pan: re(t.pan ?? .5, 0, 1),
                phaseOffset: re(t.phaseOffset ?? 0, 0, Math.PI * 2),
                useADSR: !!t.useADSR,
                attack: re(t.attack ?? .05, et, 5),
                decay: t.decay ?? .1,
                sustain: t.sustain ?? .7,
                release: re(t.release ?? .3, et, 5),
                useFM: !!t.useFM,
                fmRatio: t.fmRatio ?? 2.5,
                fmIndex: t.fmIndex ?? 5
            };
        }
        paramsSignature(t) {
            return [
                t.volume.toFixed(4),
                t.delay.toFixed(2),
                t.reverb.toFixed(3),
                t.distortion.toFixed(3),
                t.pan.toFixed(3),
                t.phaseOffset.toFixed(3),
                t.useADSR ? 1 : 0,
                t.attack.toFixed(3),
                t.decay.toFixed(3),
                t.sustain.toFixed(3),
                t.release.toFixed(3),
                t.useFM ? 1 : 0,
                t.fmRatio.toFixed(3),
                t.fmIndex.toFixed(3)
            ].join("|");
        }
        updateGlobalParams(t) {
            const n = this.context;
            if (!n || !this.globalNodes) return;
            const r = this.sanitizeParams(t), l = this.paramsSignature(r);
            if (l === this.lastParamSignature) {
                this.currentParams = r;
                return;
            }
            const i = this.globalNodes, o = n.currentTime;
            i.masterGain.gain.cancelScheduledValues(o), i.masterGain.gain.setTargetAtTime(r.volume, o, .01), i.delayNode.delayTime.cancelScheduledValues(o), i.delayNode.delayTime.setTargetAtTime(r.delay / 1e3, o, .05);
            const u = re(r.delay / 400, 0, .85);
            i.delayFeedback.gain.cancelScheduledValues(o), i.delayFeedback.gain.setTargetAtTime(u, o, .1), i.reverbGain.gain.cancelScheduledValues(o), i.reverbGain.gain.setTargetAtTime(r.reverb, o, .1), i.distortion.curve = this.distortionCache.get(r.distortion);
            const s = (r.pan - .5) * 2;
            i.stereoPanner.pan.cancelScheduledValues(o), i.stereoPanner.pan.setTargetAtTime(s, o, .05), this.currentParams = r, this.lastParamSignature = l;
        }
        async playFrequency({ noteId: t, frequency: n, waveformType: r, duration: l = Wr, params: i = {}, velocity: o = 1 }) {
            await this.ensureWasm();
            const u = await this.ensureAudioContext(), s = this.setupGraph(u);
            this.ensureVoicePool(u);
            const a = this.sanitizeParams(i);
            this.updateGlobalParams(a);
            const v = u.sampleRate, m = this.fetchWaveformSamples({
                waveformType: r,
                frequency: n,
                duration: l,
                phaseOffset: a.phaseOffset,
                useFM: a.useFM,
                fmRatio: a.fmRatio,
                fmIndex: a.fmIndex,
                sampleRate: v
            }), { data: p, releaseAfterUse: g } = this.applyEnvelopeIfNeeded(m, a, v), k = u.createBuffer(1, p.length, v);
            k.copyToChannel(p, 0), g && this.floatPool.release(p);
            const E = t || `voice-${this.voiceSerial += 1}`, O = this.acquireVoice(E);
            if (!O) return null;
            const f = re(a.volume * o, 0, 1);
            return {
                source: O.trigger({
                    buffer: k,
                    noteId: E,
                    volume: f,
                    attackTime: a.useADSR ? a.attack : et,
                    startTime: u.currentTime
                }),
                analyser: s.analyser,
                voiceId: E
            };
        }
        async preloadNote({ frequency: t, waveformType: n, duration: r = Wr, params: l = {} }) {
            await this.ensureWasm();
            const i = await this.ensureAudioContext(), o = this.sanitizeParams(l);
            this.fetchWaveformSamples({
                waveformType: n,
                frequency: t,
                duration: r,
                phaseOffset: o.phaseOffset,
                useFM: o.useFM,
                fmRatio: o.fmRatio,
                fmIndex: o.fmIndex,
                sampleRate: i.sampleRate
            });
        }
        stopNote(t) {
            const n = this.activeVoices.get(t);
            n && n.stop();
        }
        setGlobalParams(t) {
            this.updateGlobalParams(t);
        }
        getAnalyser() {
            return this.globalNodes?.analyser || null;
        }
        async precomputeCommonWaveforms() {
            if (this.commonWaveformsPrecomputed) return;
            await this.ensureWasm();
            const t = this.context?.sampleRate || ao;
            for (const n of Tp)for (const r of Np){
                const l = this.frequencyTable.get(r);
                if (!l) continue;
                const i = this.buildWaveformKey({
                    waveformType: n,
                    frequency: l,
                    duration: Wr,
                    phaseOffset: 0,
                    useFM: !1,
                    fmRatio: 0,
                    fmIndex: 0,
                    sampleRate: t
                });
                if (!this.waveformCache.has(i)) {
                    const o = vs(gs(n), l, 0, Wr, t);
                    this.waveformCache.set(i, o);
                }
            }
            this.commonWaveformsPrecomputed = !0;
        }
    }
    const we = new Op, Dp = ()=>we.ensureAudioContext(), Ap = (e, t = 1, n = "Sine", r = {}, l = {})=>we.playFrequency({
            noteId: l.noteId,
            frequency: e,
            waveformType: n,
            duration: t,
            params: r,
            velocity: l.velocity ?? 1
        }), Vp = ({ frequency: e, waveformType: t, audioParams: n = {}, duration: r })=>we.preloadNote({
            frequency: e,
            waveformType: t,
            duration: r,
            params: n
        }), pi = 4, hi = -5, mi = 2, ws = 1, Up = "clamp(72px, 18vh, 120px)", Wp = "clamp(20px, 3.8vw, 38px)", $p = "clamp(48px, 16vh, 92px)", Bp = 2 / 3, Ss = [
        {
            name: "C",
            rel: 0
        },
        {
            name: "D",
            rel: 0
        },
        {
            name: "E",
            rel: 0
        },
        {
            name: "F",
            rel: 0
        },
        {
            name: "G",
            rel: 0
        },
        {
            name: "A",
            rel: 0
        },
        {
            name: "B",
            rel: 0
        },
        {
            name: "C",
            rel: 1
        },
        {
            name: "D",
            rel: 1
        },
        {
            name: "E",
            rel: 1
        },
        {
            name: "F",
            rel: 1
        }
    ], Hp = [
        {
            name: "C#",
            rel: 0
        },
        {
            name: "D#",
            rel: 0
        },
        {
            name: "F#",
            rel: 0
        },
        {
            name: "G#",
            rel: 0
        },
        {
            name: "A#",
            rel: 0
        },
        {
            name: "C#",
            rel: 1
        },
        {
            name: "D#",
            rel: 1
        }
    ], Qp = {
        "C#": 0,
        "D#": 1,
        "F#": 3,
        "G#": 4,
        "A#": 5
    }, Gp = {
        a: {
            name: "C",
            delta: 0
        },
        s: {
            name: "D",
            delta: 0
        },
        d: {
            name: "E",
            delta: 0
        },
        f: {
            name: "F",
            delta: 0
        },
        g: {
            name: "G",
            delta: 0
        },
        h: {
            name: "A",
            delta: 0
        },
        j: {
            name: "B",
            delta: 0
        },
        k: {
            name: "C",
            delta: 1
        },
        l: {
            name: "D",
            delta: 1
        },
        ";": {
            name: "E",
            delta: 1
        },
        "'": {
            name: "F",
            delta: 1
        },
        w: {
            name: "C#",
            delta: 0
        },
        e: {
            name: "D#",
            delta: 0
        },
        t: {
            name: "F#",
            delta: 0
        },
        y: {
            name: "G#",
            delta: 0
        },
        u: {
            name: "A#",
            delta: 0
        },
        o: {
            name: "C#",
            delta: 1
        },
        p: {
            name: "D#",
            delta: 1
        }
    }, ks = {
        C4: "A",
        D4: "S",
        E4: "D",
        F4: "F",
        G4: "G",
        A4: "H",
        B4: "J",
        C5: "K",
        D5: "L",
        E5: ";",
        F5: "'",
        "C#4": "W",
        "D#4": "E",
        "F#4": "T",
        "G#4": "Y",
        "A#4": "U",
        "C#5": "O",
        "D#5": "P"
    }, Ze = (e, t, n)=>Math.min(Math.max(e, t), n), Kp = ({ waveformType: e = "Sine", audioParams: t = {}, wasmLoaded: n = !1 })=>{
        const r = F.useRef(null), l = F.useRef(new Map), i = F.useRef(new Map), o = F.useRef(new Map), u = F.useRef(new Map), s = F.useRef(new Map), a = F.useRef(new Set), v = F.useRef(t), m = F.useRef(e), p = F.useRef(n), g = F.useRef(0), k = F.useRef(new Map), E = F.useRef(null), O = F.useRef(null), f = F.useRef(null), [c, d] = F.useState(0), [w, _] = F.useState(100);
        F.useEffect(()=>{
            v.current = t;
        }, [
            t
        ]), F.useEffect(()=>{
            m.current = e;
        }, [
            e
        ]), F.useEffect(()=>{
            p.current = n;
        }, [
            n
        ]), F.useEffect(()=>{
            g.current = c;
        }, [
            c
        ]), F.useEffect(()=>()=>{
                E.current && cancelAnimationFrame(E.current), f.current && cancelAnimationFrame(f.current);
            }, []), F.useEffect(()=>{
            if (typeof PerformanceObserver > "u" || typeof window > "u") return ()=>{};
            let h;
            try {
                h = new PerformanceObserver((x)=>{
                    const L = x.getEntries();
                    if (!L.length) return;
                    const j = L[L.length - 1];
                    window.__vangelisMetrics = {
                        ...window.__vangelisMetrics || {},
                        lastLongTask: {
                            duration: j.duration,
                            startTime: j.startTime
                        },
                        lastUpdated: Date.now()
                    };
                }), h.observe({
                    type: "longtask",
                    buffered: !0
                });
            } catch  {
                return h && h.disconnect(), ()=>{};
            }
            return ()=>{
                h.disconnect();
            };
        }, []);
        const T = F.useCallback((h, x)=>{
            k.current.set(h, x), !E.current && (E.current = requestAnimationFrame(()=>{
                E.current = null, k.current.forEach((L, j)=>{
                    const B = l.current.get(j);
                    B && (L ? B.dataset.active = "true" : delete B.dataset.active);
                }), k.current.clear();
            }));
        }, []), P = F.useCallback((h)=>{
            const x = Math.round(Ze(h, 0, 1) * 126 + 1);
            O.current = x, !f.current && (f.current = requestAnimationFrame(()=>{
                f.current = null, O.current != null && _(O.current);
            }));
        }, []), R = F.useCallback((h, x)=>{
            const L = Ze(pi + g.current + x, hi + pi, mi + pi + 1), j = `${h}${L}`, B = we.getFrequency(h, L);
            return {
                noteName: h,
                octave: L,
                noteId: j,
                frequency: B
            };
        }, []), $ = F.useCallback((h, x)=>{
            if (h) {
                if (!x) {
                    l.current.delete(h);
                    return;
                }
                l.current.set(h, x);
            }
        }, []), z = F.useCallback((h, { pointerId: x = null, velocity: L = .85 } = {})=>{
            if (!p.current || !h || !h.frequency || i.current.has(h.noteId)) return;
            Dp();
            const j = Ze(L, .05, 1), B = typeof performance < "u" ? performance.now() : null, ne = Ap(h.frequency, ws, m.current, v.current, {
                noteId: h.noteId,
                velocity: j
            });
            if (ne && ne.source && (i.current.set(h.noteId, {
                source: ne.source,
                pointerId: x
            }), x !== null && o.current.set(x, h.noteId), T(h.noteId, !0), P(j), B !== null && typeof window < "u")) {
                const ct = performance.now() - B, Le = we.context ? we.context.currentTime : null;
                window.__vangelisMetrics = {
                    ...window.__vangelisMetrics || {},
                    lastNoteLatencyMs: ct,
                    lastNoteFrequency: h.frequency,
                    audioContextTime: Le,
                    lastUpdated: Date.now()
                };
            }
        }, [
            T,
            P
        ]), b = F.useCallback((h, x = null)=>{
            if (!h) return;
            const L = i.current.get(h);
            if (L) {
                try {
                    L.source.stop();
                } catch  {}
                if (i.current.delete(h), x !== null) o.current.delete(x);
                else for (const [j, B] of o.current)B === h && o.current.delete(j);
                T(h, !1);
            }
        }, [
            T
        ]), at = F.useCallback((h, x, L)=>{
            if (!x) return;
            const j = o.current.get(h);
            j !== x.noteId && (j && b(j, h), z(x, {
                pointerId: h,
                velocity: L
            }));
        }, [
            z,
            b
        ]), qe = F.useCallback((h)=>{
            if (!h || !h.frequency) return;
            const x = `${m.current}:${h.noteId}`;
            a.current.has(x) || (a.current.add(x), Vp({
                frequency: h.frequency,
                waveformType: m.current,
                audioParams: v.current,
                duration: ws
            }).catch(()=>{
                a.current.delete(x);
            }));
        }, []), Tn = F.useCallback((h)=>{
            const x = performance.now(), L = s.current.get(h) || 0;
            if (s.current.set(h, x), !L) return .85;
            const j = x - L;
            return Ze(1 - j / 250, .3, 1);
        }, []), Pn = F.useCallback((h)=>{
            const x = h.key.toLowerCase();
            if (x === "z") {
                h.preventDefault(), d((ne)=>Ze(ne - 1, hi, mi));
                return;
            }
            if (x === "x") {
                h.preventDefault(), d((ne)=>Ze(ne + 1, hi, mi));
                return;
            }
            const L = Gp[x];
            if (!L || (h.preventDefault(), u.current.has(x))) return;
            const j = R(L.name, L.delta);
            if (!j.frequency) return;
            const B = Tn(x);
            u.current.set(x, j.noteId), z(j, {
                velocity: B
            });
        }, [
            R,
            z,
            Tn
        ]), Ft = F.useCallback((h)=>{
            const x = h.key.toLowerCase(), L = u.current.get(x);
            L && (h.preventDefault(), u.current.delete(x), b(L));
        }, [
            b
        ]);
        F.useEffect(()=>(window.addEventListener("keydown", Pn, {
                passive: !1
            }), window.addEventListener("keyup", Ft, {
                passive: !1
            }), ()=>{
                window.removeEventListener("keydown", Pn), window.removeEventListener("keyup", Ft);
            }), [
            Pn,
            Ft
        ]), F.useEffect(()=>{
            const h = r.current;
            if (!h) return;
            const x = (I)=>{
                if (!I) return null;
                const Y = I.dataset.note, pe = I.dataset.name, jt = Number(I.dataset.octave), Rn = Number(I.dataset.frequency);
                return !Y || !pe || Number.isNaN(jt) || Number.isNaN(Rn) ? null : {
                    noteId: Y,
                    noteName: pe,
                    octave: jt,
                    frequency: Rn
                };
            }, L = (I)=>{
                if (I.button !== void 0 && I.button !== 0) return;
                const Y = I.target.closest("[data-note]");
                if (!Y) return;
                if (I.preventDefault(), Y.setPointerCapture) try {
                    Y.setPointerCapture(I.pointerId);
                } catch  {}
                const pe = x(Y), jt = I.pressure > 0 ? Ze(I.pressure, .05, 1) : .85;
                z(pe, {
                    pointerId: I.pointerId,
                    velocity: jt
                });
            }, j = (I)=>{
                if (!o.current.has(I.pointerId)) return;
                const Y = document.elementFromPoint(I.clientX, I.clientY), pe = Y ? Y.closest("[data-note]") : null;
                if (!pe) return;
                const jt = x(pe), Rn = I.pressure > 0 ? Ze(I.pressure, .05, 1) : .85;
                at(I.pointerId, jt, Rn);
            }, B = (I)=>{
                const Y = o.current.get(I.pointerId);
                Y && b(Y, I.pointerId);
                const pe = I.target.closest("[data-note]");
                if (pe && pe.releasePointerCapture) try {
                    pe.releasePointerCapture(I.pointerId);
                } catch  {}
            }, ne = (I)=>{
                const Y = o.current.get(I.pointerId);
                Y && b(Y, I.pointerId);
            }, ct = (I)=>{
                const Y = I.target.closest("[data-note]");
                if (!Y) return;
                const pe = x(Y);
                qe(pe);
            }, Le = (I)=>{
                const Y = I.target.closest("[data-note]");
                if (!Y) return;
                const pe = x(Y);
                qe(pe);
            };
            return h.addEventListener("pointerdown", L, {
                passive: !1
            }), h.addEventListener("pointermove", j, {
                passive: !1
            }), h.addEventListener("pointerup", B, {
                passive: !1
            }), h.addEventListener("pointercancel", B, {
                passive: !1
            }), h.addEventListener("lostpointercapture", ne, !0), h.addEventListener("pointerenter", ct, !0), h.addEventListener("focusin", Le), ()=>{
                h.removeEventListener("pointerdown", L), h.removeEventListener("pointermove", j), h.removeEventListener("pointerup", B), h.removeEventListener("pointercancel", B), h.removeEventListener("lostpointercapture", ne, !0), h.removeEventListener("pointerenter", ct, !0), h.removeEventListener("focusin", Le);
            };
        }, [
            qe,
            z,
            b,
            at
        ]);
        const Xt = F.useMemo(()=>Ss.map((h, x)=>({
                    ...R(h.name, h.rel),
                    order: x
                })), [
            R
        ]), C = F.useMemo(()=>Hp.map((h)=>{
                const x = R(h.name, h.rel), L = Qp[h.name] + (h.rel === 1 ? 7 : 0), B = `${Ze((L + Bp) / Ss.length, 0, 1) * 100}%`;
                return {
                    ...x,
                    leftOffset: B
                };
            }), [
            R
        ]);
        return y.jsxs("div", {
            className: "keyboard-wrapper",
            ref: r,
            children: [
                y.jsx("div", {
                    className: "white-keys",
                    style: {
                        gridTemplateColumns: `repeat(${Xt.length}, minmax(0, 1fr))`
                    },
                    children: Xt.map((h)=>y.jsxs("div", {
                            ref: (x)=>$(h.noteId, x),
                            className: "key-white",
                            "data-note": h.noteId,
                            "data-name": h.noteName,
                            "data-octave": h.octave,
                            "data-frequency": h.frequency,
                            tabIndex: 0,
                            style: {
                                height: Up
                            },
                            children: [
                                y.jsx("span", {
                                    className: "note-label",
                                    children: h.noteName
                                }),
                                y.jsx("span", {
                                    className: "key-label",
                                    children: ks[h.noteId] || ""
                                }),
                                y.jsx("span", {
                                    className: "key-active-indicator",
                                    "aria-hidden": "true"
                                })
                            ]
                        }, h.noteId))
                }),
                y.jsx("div", {
                    className: "black-keys-layer",
                    children: C.map((h)=>y.jsxs("div", {
                            ref: (x)=>$(h.noteId, x),
                            className: "key-black",
                            "data-note": h.noteId,
                            "data-name": h.noteName,
                            "data-octave": h.octave,
                            "data-frequency": h.frequency,
                            tabIndex: 0,
                            style: {
                                left: h.leftOffset,
                                width: Wp,
                                height: $p
                            },
                            children: [
                                y.jsx("span", {
                                    className: "note-label",
                                    children: h.noteName
                                }),
                                y.jsx("span", {
                                    className: "key-label",
                                    children: ks[h.noteId] || ""
                                }),
                                y.jsx("span", {
                                    className: "key-active-indicator",
                                    "aria-hidden": "true"
                                })
                            ]
                        }, h.noteId))
                }),
                y.jsxs("div", {
                    className: "keyboard-meta",
                    children: [
                        "Keys A-; | Sharps W-P | Z/X octave (",
                        c,
                        ") | Velocity ",
                        w
                    ]
                })
            ]
        });
    }, Fe = ({ id: e, label: t, value: n, displayValue: r, min: l, max: i, step: o, onChange: u, helpText: s })=>{
        const a = typeof l == "number" ? l : Number(l ?? 0), v = typeof i == "number" ? i : Number(i ?? 1), m = typeof n == "number" ? n : Number(n ?? 0), p = v - a === 0 ? 1 : v - a, k = {
            "--slider-progress": `${(Math.min(Math.max((m - a) / p, 0), 1) * 100).toFixed(2)}%`
        };
        return y.jsxs("div", {
            className: "slider-group",
            children: [
                y.jsxs("div", {
                    className: "label-stack",
                    children: [
                        y.jsx("label", {
                            htmlFor: e,
                            children: t
                        }),
                        y.jsx("span", {
                            className: "slider-value",
                            children: r
                        })
                    ]
                }),
                s && y.jsx("p", {
                    className: "slider-description",
                    children: s
                }),
                y.jsx("div", {
                    className: "slider-input-wrapper",
                    style: k,
                    children: y.jsx("input", {
                        id: e,
                        type: "range",
                        min: l,
                        max: i,
                        step: o,
                        value: n,
                        onChange: (E)=>u(parseFloat(E.target.value)),
                        style: k
                    })
                })
            ]
        });
    }, Yp = ({ audioParams: e, onParamChange: t })=>{
        const [n, r] = F.useState(!1);
        return y.jsxs("div", {
            className: "panel elevated control-groups",
            children: [
                y.jsxs("div", {
                    className: "control-section",
                    children: [
                        y.jsxs("div", {
                            className: "label-stack",
                            children: [
                                y.jsx("h2", {
                                    className: "controls-heading",
                                    children: "Essentials"
                                }),
                                y.jsx("button", {
                                    type: "button",
                                    className: "button-link",
                                    onClick: ()=>r((l)=>!l),
                                    children: n ? "Hide advanced" : "Show advanced"
                                })
                            ]
                        }),
                        y.jsx(Fe, {
                            id: "volume",
                            label: "Volume",
                            value: Math.round((e.volume ?? .7) * 100),
                            displayValue: `${Math.round((e.volume ?? .7) * 100)}%`,
                            min: 0,
                            max: 100,
                            step: 1,
                            onChange: (l)=>t("volume", l / 100),
                            helpText: "Set the output level. Designed for quick sweeps and precise control."
                        }),
                        y.jsx(Fe, {
                            id: "pan",
                            label: "Stereo pan",
                            value: Math.round((e.pan ?? .5) * 100),
                            displayValue: `L${Math.round(((e.pan ?? .5) - .5) * 200)} R`,
                            min: 0,
                            max: 100,
                            step: 1,
                            onChange: (l)=>t("pan", l / 100)
                        })
                    ]
                }),
                y.jsxs("div", {
                    className: "control-section",
                    children: [
                        y.jsx("h2", {
                            className: "controls-heading",
                            children: "Effects"
                        }),
                        y.jsx(Fe, {
                            id: "delay",
                            label: "Delay",
                            value: e.delay ?? 0,
                            displayValue: `${Math.round(e.delay ?? 0)} ms`,
                            min: 0,
                            max: 500,
                            step: 10,
                            onChange: (l)=>t("delay", l)
                        }),
                        y.jsx(Fe, {
                            id: "reverb",
                            label: "Reverb",
                            value: Math.round((e.reverb ?? 0) * 100),
                            displayValue: `${Math.round((e.reverb ?? 0) * 100)}%`,
                            min: 0,
                            max: 100,
                            step: 1,
                            onChange: (l)=>t("reverb", l / 100)
                        }),
                        y.jsx(Fe, {
                            id: "distortion",
                            label: "Distortion",
                            value: Math.round((e.distortion ?? 0) * 100),
                            displayValue: `${Math.round((e.distortion ?? 0) * 100)}%`,
                            min: 0,
                            max: 100,
                            step: 1,
                            onChange: (l)=>t("distortion", l / 100)
                        })
                    ]
                }),
                n && y.jsxs("div", {
                    className: "control-section",
                    children: [
                        y.jsx("h2", {
                            className: "controls-heading",
                            children: "Modulation"
                        }),
                        y.jsxs("label", {
                            className: "toggle-row",
                            htmlFor: "use-adsr",
                            children: [
                                y.jsx("span", {
                                    children: "ADSR envelope"
                                }),
                                y.jsx("input", {
                                    id: "use-adsr",
                                    type: "checkbox",
                                    checked: e.useADSR ?? !1,
                                    onChange: (l)=>t("useADSR", l.target.checked)
                                })
                            ]
                        }),
                        e.useADSR && y.jsxs("div", {
                            className: "slider-grid",
                            children: [
                                y.jsx(Fe, {
                                    id: "attack",
                                    label: "Attack",
                                    value: e.attack ?? .05,
                                    displayValue: `${(e.attack ?? .05).toFixed(2)} s`,
                                    min: 0,
                                    max: 2,
                                    step: .01,
                                    onChange: (l)=>t("attack", l)
                                }),
                                y.jsx(Fe, {
                                    id: "decay",
                                    label: "Decay",
                                    value: e.decay ?? .1,
                                    displayValue: `${(e.decay ?? .1).toFixed(2)} s`,
                                    min: 0,
                                    max: 2,
                                    step: .01,
                                    onChange: (l)=>t("decay", l)
                                }),
                                y.jsx(Fe, {
                                    id: "sustain",
                                    label: "Sustain",
                                    value: Math.round((e.sustain ?? .7) * 100),
                                    displayValue: `${Math.round((e.sustain ?? .7) * 100)}%`,
                                    min: 0,
                                    max: 100,
                                    step: 1,
                                    onChange: (l)=>t("sustain", l / 100)
                                }),
                                y.jsx(Fe, {
                                    id: "release",
                                    label: "Release",
                                    value: e.release ?? .3,
                                    displayValue: `${(e.release ?? .3).toFixed(2)} s`,
                                    min: 0,
                                    max: 3,
                                    step: .01,
                                    onChange: (l)=>t("release", l)
                                })
                            ]
                        }),
                        y.jsxs("label", {
                            className: "toggle-row",
                            htmlFor: "use-fm",
                            children: [
                                y.jsx("span", {
                                    children: "Frequency modulation"
                                }),
                                y.jsx("input", {
                                    id: "use-fm",
                                    type: "checkbox",
                                    checked: e.useFM ?? !1,
                                    onChange: (l)=>t("useFM", l.target.checked)
                                })
                            ]
                        }),
                        e.useFM && y.jsxs("div", {
                            className: "slider-grid",
                            children: [
                                y.jsx(Fe, {
                                    id: "fm-ratio",
                                    label: "FM ratio",
                                    value: e.fmRatio ?? 2.5,
                                    displayValue: `${(e.fmRatio ?? 2.5).toFixed(2)} : 1`,
                                    min: .5,
                                    max: 6,
                                    step: .1,
                                    onChange: (l)=>t("fmRatio", l)
                                }),
                                y.jsx(Fe, {
                                    id: "fm-index",
                                    label: "FM index",
                                    value: e.fmIndex ?? 5,
                                    displayValue: `${(e.fmIndex ?? 5).toFixed(1)}`,
                                    min: 0,
                                    max: 20,
                                    step: .5,
                                    onChange: (l)=>t("fmIndex", l)
                                })
                            ]
                        }),
                        y.jsx(Fe, {
                            id: "phase-offset",
                            label: "Phase offset",
                            value: e.phaseOffset ?? 0,
                            displayValue: `${Math.round(e.phaseOffset ?? 0)}°`,
                            min: 0,
                            max: 360,
                            step: 1,
                            onChange: (l)=>t("phaseOffset", l)
                        })
                    ]
                })
            ]
        });
    }, Xp = [
        "Sine",
        "Sawtooth",
        "Square",
        "Triangle"
    ], qp = ({ currentWaveform: e, onWaveformChange: t })=>y.jsxs("div", {
            className: "panel elevated waveform-panel",
            children: [
                y.jsxs("div", {
                    className: "label-stack",
                    children: [
                        y.jsx("h2", {
                            className: "controls-heading",
                            children: "Waveform"
                        }),
                        y.jsx("span", {
                            className: "slider-value",
                            children: e
                        })
                    ]
                }),
                y.jsx("p", {
                    className: "panel-subtitle",
                    children: "Choose the harmonic profile for the instrument. Changes update instantly."
                }),
                y.jsx("div", {
                    className: "waveform-grid",
                    role: "radiogroup",
                    "aria-label": "Waveform selection",
                    children: Xp.map((n)=>{
                        const r = e === n;
                        return y.jsx("button", {
                            type: "button",
                            className: `waveform-button${r ? " is-active" : ""}`,
                            onClick: ()=>t(n),
                            role: "radio",
                            "aria-checked": r,
                            children: y.jsx("span", {
                                children: n
                            })
                        }, n);
                    })
                }),
                y.jsxs("div", {
                    className: "panel-footer",
                    children: [
                        y.jsx("span", {
                            className: "control-chip",
                            children: "Shift + / opens shortcuts"
                        }),
                        y.jsx("span", {
                            className: "control-chip",
                            children: "Z / X for octave"
                        })
                    ]
                })
            ]
        }), Zp = ()=>{
        const [e, t] = F.useState(()=>we.getStatus()), [n, r] = F.useState("Sine"), [l, i] = F.useState({
            reverb: 0,
            delay: 0,
            distortion: 0,
            volume: .7,
            useADSR: !1,
            attack: .05,
            decay: .1,
            sustain: .7,
            release: .3,
            useFM: !1,
            fmRatio: 2.5,
            fmIndex: 5,
            pan: .5,
            phaseOffset: 0
        }), [o, u] = F.useState(!1), s = F.useRef(null), a = e.wasmReady, v = e.graphWarmed;
        F.useEffect(()=>{
            we.setGlobalParams(l);
        }, [
            l
        ]), F.useEffect(()=>{
            const p = we.subscribe(t);
            return we.ensureWasm().catch(()=>{}), we.ensureAudioContext().then(()=>{
                we.warmGraph();
            }), p;
        }, []), F.useEffect(()=>{
            const p = (g)=>{
                (g.key === "?" || g.key === "/" && g.shiftKey) && (g.preventDefault(), u((k)=>!k)), g.key === "Escape" && u(!1);
            };
            return window.addEventListener("keydown", p), ()=>window.removeEventListener("keydown", p);
        }, []), F.useEffect(()=>{
            const p = document.documentElement, g = ()=>{
                s.current = null;
                const E = p.scrollHeight - p.clientHeight, O = E > 0 ? window.scrollY / E : 0;
                p.style.setProperty("--scroll-progress", O.toFixed(4));
            }, k = ()=>{
                s.current === null && (s.current = requestAnimationFrame(g));
            };
            return g(), window.addEventListener("scroll", k, {
                passive: !0
            }), ()=>{
                s.current !== null && cancelAnimationFrame(s.current), window.removeEventListener("scroll", k);
            };
        }, []);
        const m = (p, g)=>{
            i((k)=>({
                    ...k,
                    [p]: g
                }));
        };
        return y.jsxs("div", {
            className: "app-stage",
            children: [
                y.jsxs("div", {
                    className: "parallax-stage",
                    "aria-hidden": "true",
                    children: [
                        y.jsx("div", {
                            className: "parallax-layer parallax-layer--far"
                        }),
                        y.jsx("div", {
                            className: "parallax-layer parallax-layer--mid"
                        }),
                        y.jsx("div", {
                            className: "parallax-layer parallax-layer--near"
                        })
                    ]
                }),
                y.jsxs("div", {
                    className: "app-shell",
                    children: [
                        y.jsxs("header", {
                            className: "zone-top tier-subtle drift-slow content-tertiary",
                            "aria-label": "Branding and quick actions",
                            children: [
                                y.jsx("div", {
                                    className: "branding",
                                    children: y.jsx("span", {
                                        className: "brand-title",
                                        children: "Vangelis"
                                    })
                                }),
                                y.jsxs("div", {
                                    className: "top-actions",
                                    role: "group",
                                    "aria-label": "Utility controls",
                                    children: [
                                        y.jsx("button", {
                                            type: "button",
                                            className: "button-icon",
                                            "aria-label": "View keyboard shortcuts",
                                            onClick: ()=>u(!0),
                                            children: y.jsx("span", {
                                                "aria-hidden": "true",
                                                children: "?"
                                            })
                                        }),
                                        y.jsx("button", {
                                            type: "button",
                                            className: "button-icon",
                                            "aria-label": "Open settings",
                                            children: y.jsxs("svg", {
                                                width: "16",
                                                height: "16",
                                                viewBox: "0 0 24 24",
                                                fill: "none",
                                                xmlns: "http://www.w3.org/2000/svg",
                                                children: [
                                                    y.jsx("path", {
                                                        d: "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z",
                                                        stroke: "currentColor",
                                                        strokeWidth: "1.5",
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round"
                                                    }),
                                                    y.jsx("path", {
                                                        d: "M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z",
                                                        stroke: "currentColor",
                                                        strokeWidth: "1.5",
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round"
                                                    })
                                                ]
                                            })
                                        })
                                    ]
                                })
                            ]
                        }),
                        y.jsx("main", {
                            className: "zone-center content-primary",
                            "aria-label": "Keyboard area",
                            children: y.jsxs("div", {
                                className: "keyboard-surface tier-focus drift-medium",
                                role: "region",
                                "aria-label": "Virtual keyboard",
                                children: [
                                    y.jsxs("div", {
                                        className: "keyboard-header",
                                        children: [
                                            y.jsx("span", {
                                                children: "Keyboard"
                                            }),
                                            y.jsxs("span", {
                                                className: "keyboard-legend",
                                                children: [
                                                    "Waveform · ",
                                                    n
                                                ]
                                            })
                                        ]
                                    }),
                                    y.jsxs("div", {
                                        className: "keyboard-region",
                                        children: [
                                            y.jsx(Kp, {
                                                waveformType: n,
                                                audioParams: l,
                                                wasmLoaded: a
                                            }),
                                            !v && y.jsxs("div", {
                                                className: "warmup-indicator",
                                                "aria-live": "polite",
                                                children: [
                                                    y.jsx("span", {
                                                        className: "warmup-indicator__pulse",
                                                        "aria-hidden": "true"
                                                    }),
                                                    y.jsx("span", {
                                                        children: "Warming up audio engine…"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        }),
                        y.jsx("section", {
                            className: "zone-bottom content-secondary",
                            "aria-label": "Control surface",
                            children: y.jsxs("div", {
                                className: "controls-surface tier-support drift-fast",
                                children: [
                                    y.jsx("div", {
                                        className: "controls-panel",
                                        "aria-label": "Waveform selection",
                                        children: y.jsx(qp, {
                                            currentWaveform: n,
                                            onWaveformChange: r
                                        })
                                    }),
                                    y.jsx("div", {
                                        className: "controls-panel wide",
                                        "aria-label": "Audio controls",
                                        children: y.jsx(Yp, {
                                            audioParams: l,
                                            onParamChange: m
                                        })
                                    })
                                ]
                            })
                        }),
                        o && y.jsx("div", {
                            className: "shortcuts-overlay",
                            role: "dialog",
                            "aria-modal": "true",
                            "aria-label": "Keyboard shortcuts",
                            children: y.jsxs("div", {
                                className: "shortcuts-card tier-support",
                                children: [
                                    y.jsxs("div", {
                                        className: "shortcuts-header",
                                        children: [
                                            y.jsx("span", {
                                                children: "Keyboard Shortcuts"
                                            }),
                                            y.jsx("button", {
                                                type: "button",
                                                className: "button-icon",
                                                "aria-label": "Close shortcuts",
                                                onClick: ()=>u(!1),
                                                children: y.jsx("span", {
                                                    "aria-hidden": "true",
                                                    children: "×"
                                                })
                                            })
                                        ]
                                    }),
                                    y.jsxs("dl", {
                                        className: "shortcuts-grid",
                                        children: [
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "A – ;"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Play white keys across the active octave"
                                                    })
                                                ]
                                            }),
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "W – P"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Play black keys across the active octave"
                                                    })
                                                ]
                                            }),
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "Z / X"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Shift octave down or up"
                                                    })
                                                ]
                                            }),
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "C / V"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Adjust key velocity"
                                                    })
                                                ]
                                            }),
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "Shift + / (?)"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Toggle this overlay"
                                                    })
                                                ]
                                            }),
                                            y.jsxs("div", {
                                                children: [
                                                    y.jsx("dt", {
                                                        children: "Escape"
                                                    }),
                                                    y.jsx("dd", {
                                                        children: "Close overlays"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        })
                    ]
                })
            ]
        });
    };
    await we.ensureWasm();
    we.warmGraph();
    vi.createRoot(document.getElementById("root")).render(y.jsx(ef.StrictMode, {
        children: y.jsx(Zp, {})
    }));
    "serviceWorker" in navigator && window.addEventListener("load", ()=>{
        navigator.serviceWorker.register("/sw.js").catch(()=>{});
    });
})();
