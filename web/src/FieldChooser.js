
// Here is also a plugin that uses object and field selection: https://github.com/programmfabrik/easydb-custom-data-type-gazetteer/blob/2d12b38c43dd8920781dbf3643eb685dc5b97e53/src/webfrontend/CustomBaseConfigGazetteer.coffee#L44

// TODO: Save selection



class FieldChooserConfig extends BaseConfigPlugin {
    getFieldDefFromParm(baseConfig, pname, def, parent_def) {
        if (def.plugin_type !== "field-chooser") {
            return;
        }

        const allTags = []
        for (const tg of ez5.tagForm.data) {
            for (const t of tg._tags) {
                allTags.push({
                    text: tg.taggroup.displayname['de-DE'] + ': ' + t.tag.displayname['de-DE'],
                    value: tg.taggroup._id + '_' + t.tag._id,
                })
            }
        }

        const tagSelectOptions = [{
            text: $$("server.config.parameter.system.citizenarchives-base.tag_chooser.placeholder"),
            value: null,
        }]
        for (const tagGroup of ez5.tagForm.tagGroups) {
            tagSelectOptions.push({
                label: tagGroup.getDisplayName(),
            })
            for (const tag of tagGroup.getTags()) {
                tagSelectOptions.push({
                    text: tag.getDisplayName(),
                    value: parseInt(tag.getId()),
                })
            }
        }

        // return {
        //     type: CUI.Select,
        //     name: "tag_chooser",  // must be the same as in manifest
        //     options: [{
        //         text: $$("server.config.parameter.system.citizenarchives-base.tag_chooser.placeholder"),
        //         value: '',
        //     },
        //         ...allTags
        //     ]
        // }

        return {
            type: CUI.Form,
            name: "fields_chooser",
            fields: [{
                type: CUI.DataTable,
                name: "data_table",
                fields: [{
                    form: {
                        label: $$("server.config.parameter.system.citizenarchives-base.field-chooser.model.label")
                    },
                    type: CUI.Select,
                    name: "model",
                    options: [{
                        text: '',
                        value: '', 
                    }, ...ez5.schema.CURRENT.tables.map((table) => ({
                        text: table.name,
                        value: table.table_id,
                    }))],
                    onDataChanged: (data, field) => {
                        // Reset field option to empty
                        field.getForm().getFieldsByName("field")[0].setValue('').displayValue()
                    }
                }, {
                    form: {
                        label: $$("server.config.parameter.system.citizenarchives-base.field-chooser.field.label")
                    },
                    type: CUI.Select,
                    name: "field",
                    options: (select, event) => {
                        const EMPTY_OPTION = {
                            text: '',
                            value: '',
                        }
                        const tableId = select.getForm().getFieldsByName("model")[0].getValue()
                        for (const model of ez5.schema.CURRENT.tables) {
                           if (model.table_id === tableId) {
                                return [EMPTY_OPTION, ...model.columns.map((column) => ({
                                    text: column.name,
                                    value: column.column_id,
                                }))]
                            }
                        }
                        return [EMPTY_OPTION]
                    }
                }, {
                    form: {
                        label: $$("server.config.parameter.system.citizenarchives-base.tag_choose1.label")
                    },
                    type: CUI.Select,
                    name: "trigger-tag",
                    options: tagSelectOptions,
                }, {
                    form: {
                        label: $$("server.config.parameter.system.citizenarchives-base.tag_choose2.label")
                    },
                    type: CUI.Select,
                    name: "marking-tag",
                    options: tagSelectOptions,
                }]
            }]
        }
    }
}




CUI.ready(() => {
    BaseConfig.registerPlugin(new FieldChooserConfig());
});









/*class ObjecttypeSelector extends CUI.Select {
    initOpts() {
        super.initOpts();
        this.addOpts({
            filter: {
                check: Function
            },
            store_value: {
                check: ["fullname", "objecttype", "id"],
                default: "id"
            },
            show_name: {
                check: Boolean,
                default: false
            },
            placeholder: {
                check: String,
                default: $$("objecttype.selector.placeholder")
            }
        });
        this.opts.options = [];
    }

    readOpts() {
        super.readOpts();
        this._options = this.__getOptions();
        this._empty_text = this._empty_text || this._placeholder;
    }

    setData(data) {
        super.setData(data);

        if (!this._options.some(option => option.value === data[this._getName()])) {
            data[this._getName()] = null;
        }
    }

    __getOptions() {
        const options = [{
            text: this._placeholder,
            value: null
        }];

        for (const ot of ez5.schema.CURRENT._objecttypes) {
            const objectType = new Objecttype(new Table("CURRENT", ot.table_id));

            if (this._filter && !this._filter(objectType)) {
                continue;
            }

            let value;
            switch (this._store_value) {
                case "objecttype":
                    value = ot;
                    break;
                case "fullname":
                    value = ot.name;
                    break;
                case "id":
                    value = ot.table_id;
                    break;
            }

            let text = objectType.nameLocalized();
            if (this._show_name) {
                text += ` [${objectType.name()}]`;
            }

            options.push({
                text: text,
                value: value
            });
        }

        return options;
    }
}*/
