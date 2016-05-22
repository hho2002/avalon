//用于chrome, safari
var tags = {}
function byCustomElement(name) {
    if (tags[name])
        return
    tags[name] = true
    var prototype = Object.create(HTMLElement.prototype)
    prototype.detachedCallback = function () {
        var dom = this
        setTimeout(function () {
            fireDisposeHook(dom)
        })
    }
    document.registerElement(name, prototype)
}


//用于IE9+, firefox
function byRewritePrototype() {
    if (byRewritePrototype.execute) {
        return
    }
//https://www.web-tinker.com/article/20618.html?utm_source=tuicool&utm_medium=referral
//IE6-8虽然暴露了Element.prototype,但无法重写已有的DOM API
    byRewritePrototype.execute = true
    var p = Node.prototype
    function rewite(name, fn) {
        var cb = p[name]
        p[name] = function (a, b) {
            return  fn.call(this, cb, a, b)
        }
    }
    rewite('removeChild', function (fn, a, b) {
        fn.call(this, a, b)
        if (a.nodeType === 1) {
            setTimeout(function () {
                fireDisposeHook(a)
            })
        }
        return a
    })

    rewite('replaceChild', function (fn, a, b) {
        fn.call(this, a, b)
        if (a.nodeType === 1) {
            setTimeout(function () {
                fireDisposeHook(a)
            })
        }
        return a
    })

    rewite('innerHTML', function (fn, html) {
        var all = this.getElementsByTagName('*')
        fn.call(this, html)
        fireDisposedComponents(all)
    })

    rewite('appendChild', function (fn, a) {
        fn.call(this, a)
        if (a.nodeType === 1 && this.nodeType === 11) {
            setTimeout(function () {
                fireDisposeHook(a)
            })
        }
        return a
    })

    rewite('insertBefore', function (fn, a) {
        fn.call(this, a)
        if (a.nodeType === 1 && this.nodeType === 11) {
            setTimeout(function () {
                fireDisposeHook(a)
            })
        }
        return a
    })
}



module.exports = {
    byCustomElement: byCustomElement,
    byRewritePrototype: byRewritePrototype
}

function fireDisposeHook(el) {
    if (el.nodeType === 1 && el.getAttribute('wid') && !avalon.contains(avalon.root, el)) {
        var wid = el.getAttribute('wid')
        var docker = avalon.resolvedComponents[ wid ]
        var vm = docker.vmodel
        var cached = !!docker.cached
        docker.vmodel.$fire("onDispose", {
            type: 'dispose',
            target: el,
            vmodel: vm,
            cached: cached
        })
        if (docker && docker.vmodel && !cached) {
            vm.$element = null
            vm.$hashcode = false
            delete docker.vmodel
            delete avalon.resolvedComponents[ wid ]
        }
        return false
    }
}

function fireDisposedComponents(nodes) {
    for (var i = 0, el; el = nodes[i++]; ) {
        fireDisposeHook(el)
    }
}