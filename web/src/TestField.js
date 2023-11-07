class TestFieldConfig extends BaseConfigPlugin {
    queryApi(path, body) {
        const baseUrl = ez5.pluginManager.getPlugin("citizenarchives").getBareBaseURL().replace('/plugin/static', '/plugin/extension').slice(0, -1)
        return new CUI.XHR({
            method: "POST",
            url: "https://fylr.datahive.one/api/v1/plugin/extension/citizenarchives/test",
            headers: {
                'X-Fylr-Authorization': 'Bearer ' + ez5.session.token,
            },
            body: body,
        })
    }


    getFieldDefFromParm(baseConfig, pname, def, parent_def) {
        if (def.plugin_type !== "testfield") {
            return;
        }

        const TEXTFIELD_NAME = 'test-text'

        return {
            type: CUI.Form,
            name: "kjansdajnsd",  // don't ask, don't rename
            fields: [{
                type: CUI.DataFieldProxy,
                element: (dataField) =>
                    new CUI.Label({
                        multiline: true,
                        text: "Testen Sie hier Texte und sehen Sie, wie diese beurteilt werden.",
                        markdown: true
                    })
            }, {
                type: CUI.Input,
                textarea: true,
                name: TEXTFIELD_NAME,
            }, {
                type: CUI.DataFieldProxy,
                element: (dataField) =>
                    new CUI.Button({
                        text: $$("server.config.parameter.system.citizenarchives-testing.testfield.button.label"),
                        onClick: () => this.exec({dataField}, dataField.getForm().getData()[TEXTFIELD_NAME])
                    }),
            }, {
                type: CUI.DataFieldProxy,
                element: (dataField) =>
                    new CUI.Label({
                        text: " ",  // can not be empty, otherwise no span element is created
                        multiline: true,
                        class: "citizenarchives-evaluation",
                    })
            }]
        }
    }


    exec(context, text) {
        this.setResultText(context, "Lade...")
        CitizenArchivesAPI.evaluate(text).then((result) => {
            const {text, evaluations} = result

            let textParts = []

            const headlines = {
                markings: 'Übermäßige Markierungen',
                spelling: 'Rechtschreibung',
                sentiment: 'Sentiment',
                german: 'Deutsche Sprache',
                chatgpt: 'ChatGPT',
                predefinedBlocklist: 'Vorgefertigte Blockliste',
                customBlocklist: 'Eigene Blockliste',
            }

            if (result.error) {
                this.setResultText(context, 'Fehler: '+result.error)
            }
            else {
                textParts.push("Fazit: "+(result.failed? "Sollte überprüft werden." : "Keine Auffälligkeiten über Schwellwerten gefunden.")+"\n")

                for (const key in headlines) {
                    const {rating, details, threshold} = evaluations[key]
                    let text = ''
                    text += headlines[key]+': '
                    if (typeof rating === 'boolean') {
                        text += rating? 'okay' : 'nicht okay'
                    } else {
                        text += Math.round(rating*100)+'% problematisch bei Schwellwert von '+Math.round(threshold*100)+'%'
                    }
                    text += '\n'
                    for (const descr in details) {
                        text += '...' + descr + ': ' + this.stringifyValue(details[descr]) + '\n'
                    }
                    textParts.push(text)
                }

                this.setResultText(context, textParts.join('\n'))
            }
        })
    }


    setResultText(context, text) {
        const {dataField} = context
        const evalField = dataField.getForm().DOM.querySelector('.citizenarchives-evaluation span')
        evalField.style['white-space-collapse'] = 'preserve'
        evalField.innerText = text
    }


    stringifyValue(value) {
        if (value===null || value===undefined || value==='' || (Array.isArray(value) && value.length===0)) {
            return '-'
        }
        if (Array.isArray(value)) {
            return value.join(', ')
        }
        return '' + value
    }
}




CUI.ready(() => {
    BaseConfig.registerPlugin(new TestFieldConfig())
})
