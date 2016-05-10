var disposeDetectStrategy = require('../component/disposeDetectStrategy')
var patch = require('../strategy/patch')

//插入点机制,组件的模板中有一些slot元素,用于等待被外面的元素替代
var dir = avalon.directive('widget', {
    priority: 4,
    parse: function (binding, num, elem) {
        var isVoidTag = !!elem.isVoidTag
        elem.isVoidTag = true
        var wid = elem.props.wid || (elem.props.wid = avalon.makeHashCode('w'))
        avalon.resolvedComponents[wid] = {
            props: avalon.shadowCopy({}, elem.props),
            template: elem.template
        }
        var ret = [
            'vnode' + num + '._isVoidTag = ' + isVoidTag,
            'vnode' + num + '.props.wid = "' + wid + '"',
            'vnode' + num + '.template = ' + avalon.quote(elem.template),
            'vnode' + num + '.props["ms-widget"] = ' + avalon.parseExpr(binding, 'widget'),
            'vnode' + num + ' = avalon.component(vnode' + num + ', __vmodel__)',
            'if(typeof vnode' + num + '.render === "string"){',
            'avalon.__widget = [];',
            'var __backup__ = __vmodel__;',
            '__vmodel__ = vnode' + num + '.vmodel;',
            'try{eval(" new function(){"+ vnode' + num + '.render +"}");',
            '}catch(e){avalon.warn(e)', '}',
            'vnode' + num + ' = avalon.renderWidget(avalon.__widget[0])', '}',
            '__vmodel__ = __backup__;']
        return ret.join('\n') + '\n'
    },
    define: function () {
        return avalon.mediatorFactory.apply(this, arguments)
    },
    diff: function (cur, pre, steps) {
        var coms = avalon.resolvedComponents
        var wid = cur.props.wid
        var docker = coms[wid]
        if (!docker || !docker.renderCount) {
            steps.count += 1
            cur.change = [this.replaceByComment]
        } else if (!pre.props.resolved) {
            cur.steps = steps
            var list = cur.change || (cur.change = [])
            if(avalon.Array.ensure(list, this.replaceByComponent)){
                 steps.count += 1
            }
            cur.afterChange = [
                function (dom, vnode) {
                    cur.vmodel.$fire('onReady', {
                        type: 'ready',
                        target: dom,
                        wid: wid,
                        vmodel: vnode.vmodel
                    })
                    docker.renderCount = 2
                }
            ]
            //处理模板不存在指令的情况
            if (cur.children.length === 0) {
                steps.count += 1
            }
            //处理模板不存在指令的情况
        } else {
            var needUpdate = !cur.diff || cur.diff(cur, pre, steps)
            cur.skipContent = !needUpdate
            var viewChangeObservers = cur.vmodel.$events.onViewChange
            if (viewChangeObservers && viewChangeObservers.length) {
                steps.count += 1
                cur.afterChange = [function (dom, vnode) {
                        var preHTML = avalon.vdomAdaptor(pre, 'toHTML')
                        var curHTML = avalon.vdomAdaptor(cur, 'toHTML')
                        if (preHTML !== curHTML) {
                            cur.vmodel.$fire('onViewChange', {
                                type: 'viewchange',
                                target: dom,
                                wid: wid,
                                vmodel: vnode.vmodel
                            })
                        }
                        docker.renderCount++
                    }]
            }

        }
    },
    addDisposeMonitor: function (dom) {
        if (window.chrome && window.MutationEvent) {
            disposeDetectStrategy.byMutationEvent(dom)
        } else if (Object.defineProperty && window.Node) {
            disposeDetectStrategy.byRewritePrototype(dom)
        } else {
            disposeDetectStrategy.byPolling(dom)
        }
    },
    replaceByComment: function (dom, node, parent) {
        var comment = document.createComment(node.nodeValue)
        if (dom) {
            parent.replaceChild(comment, dom)
        } else {
            parent.appendChild(comment)
        }
    },
    replaceByComponent: function (dom, node, parent) {
        var hasDdash = node.type.indexOf('-') > 0
        var hasDetect = false
        if (hasDdash && document.registerElement) {
            //必须在自定义标签实例化时,注册它
            disposeDetectStrategy.byCustomElement(node.type)
            hasDetect = true
        }
        var com = avalon.vdomAdaptor(node, 'toDOM')
        if (dom) {
            parent.replaceChild(com, dom)
        } else {
            parent.appendChild(com)
        }
        patch([com], [node], parent, node.steps)
        if (!hasDetect) {
            dir.addDisposeMonitor(com)
        }
        return false
    }
})




// http://www.besteric.com/2014/11/16/build-blog-mirror-site-on-gitcafe/