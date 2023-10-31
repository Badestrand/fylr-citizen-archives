class BlocklistPresetConfig extends BaseConfigPlugin {
    getFieldDefFromParm(baseConfig, pname, def, parent_def) {
        if (def.plugin_type !== "blocklist-preset") {
            return
        }

        return {
            type: CUI.Form,
            name: "blocklist_preset",
            fields: [{
                type: CUI.DataFieldProxy,
                call_others: false,
                element: (dataField) => {
                    return new CUI.VerticalList({
                        content: [
                            new CUI.Label({
                                multiline: true,
                                text: "Es wird eine vorgefertigte Blockliste mitgeliefert, deren Wortinhalte zum Markieren führt.",
                                markdown: true
                            }),
                            new CUI.HorizontalList({
                                content: [
                                    new CUI.Button({
                                        text: "Anzeigen",
                                        onClick: this.showBlocklist.bind(this)
                                    }),
                                    new CUI.Button({
                                        text: "Download",
                                        onClick: this.downloadBlocklist.bind(this)
                                    }),
                                ]
                            })
                        ]
                    })
                }
            }]
        }
    }

    showBlocklist() {
        CitizenArchivesAPI.getPresetBlocklist().then((text) => {
            const newTab = window.open()
            const preElement = newTab.document.createElement('pre')  // wrap everything in a 'pre' tag so newlines and special characters get regarded as-is
            const textNode = newTab.document.createTextNode(text)
            preElement.appendChild(textNode)
            newTab.document.body.appendChild(preElement)
            newTab.document.close()
        })
    }

    downloadBlocklist() {
        CitizenArchivesAPI.getPresetBlocklist().then((text) => {
            const blob = new Blob([text], {type:'text/plain'})
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = 'blocklist.txt'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

        })
    }
}



CUI.ready(() => {
    BaseConfig.registerPlugin(new BlocklistPresetConfig())
})
