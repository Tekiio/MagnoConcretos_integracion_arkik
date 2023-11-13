/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/log', 'N/record', 'N/search'],
    /**
     * @param{currentRecord} currentRecord
     * @param{log} log
     * @param{record} record
     * @param{search} search
     */
    function (currentRecord, log, record, search) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {
            console.log("Hola entre");
        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            try {

                console.log({ title: 'scriptContext.currentRecord', details: scriptContext.currentRecord });
                var objRecord = scriptContext.currentRecord;
                console.log({ title: 'objRecord', details: objRecord });
                var subtipo = objRecord.getValue({ fieldId: 'subtype' });
                console.log({ title: 'tipo', details: subtipo });

                var tipoRegistro = objRecord.type;
                var id = objRecord.id;
                console.log('registro: ', tipoRegistro);


                if (tipoRegistro === 'inventoryitem') {

                    if (scriptContext.fieldId === 'stockunit') {

                        var stockUnit = objRecord.getText({ fieldId: 'stockunit' });
                        
                        if (stockUnit == 'PIEZAS' || stockUnit == 'BOLSAS') {
                            objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true})
                        } else {
                            var abreviatura = obtainUnits(stockUnit);
                            objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                        }
                    }else if(scriptContext.fieldId === 'purchaseunit'){
                        var purchaseUnit = objRecord.getText({ fieldId: 'purchaseunit' });
                        
                        if (purchaseUnit == 'PIEZAS' || purchaseUnit == 'BOLSAS') {
                            objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true})
                        } else {
                            var abreviatura = obtainUnits(purchaseUnit);                
                            objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                        }
                    }
                } else {
                    if(subtipo == 'Sale'){
                        if(scriptContext.fieldId === 'saleunit'){
                            var unit = objRecord.getText({ fieldId: 'saleunit' });
                            var abreviatura = obtainUnits(unit);

                            if (unit == 'PIEZAS' || unit == 'BOLSAS') {
                                
                                objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true});
                                objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true})

                            } else {
                                var abreviatura = obtainUnits(unit);
                                objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                                objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                            }
                        }
                    }else{
                        if(scriptContext.fieldId === 'purchaseunit'){
                            var unit = objRecord.getText({ fieldId: 'purchaseunit' });
                            var abreviatura = obtainUnits(unit);

                            if (unit == 'PIEZAS' || unit == 'BOLSAS') {
                                objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true})
                                objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: 'EA',ignoreFieldChange: false,forceSyncSourcing: true})
                            } else {
                                var abreviatura = obtainUnits(unit);
                                objRecord.setValue({fieldId: 'custitem_tkiio_uom_base_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                                objRecord.setValue({fieldId: 'custitem_tkiio_unit_arkik',value: abreviatura,ignoreFieldChange: false,forceSyncSourcing: true})
                            }
                        }
                    }

                }

            } catch (error) {
                console.error(error)
            }



        }

        /**
         * @summary Función que servirá para obtener la abreviación de la unidad de cada Artículo
         * @param {*} stockUnit 
         * @returns 
         */
        function obtainUnits(stockUnit) {
            try {
                var unitstypeSearchObj = search.create({
                    type: "unitstype",
                    filters:
                        [
                            ["pluralname", "startswith", stockUnit]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "abbreviation", label: "Abreviatura" }),
                            search.createColumn({name: "name",sort: search.Sort.ASC,label: "Nombre"}),
                            search.createColumn({ name: "unitname", label: "Nombre de la unidad" })
                        ]
                });
                var searchResultCount = unitstypeSearchObj.runPaged().count;
                log.debug("unitstypeSearchObj result count", searchResultCount);
                
                var unit = '';
                unitstypeSearchObj.run().each(function (result) {
                    unit = result.getValue({name: 'abbreviation'});
                    return true;
                });

                console.log('abreviacion: ',unit);

                return unit;

            } catch (error) {
                console.error('obtainUnits: ', error);
                return '';
            }
        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

        }

        /**
         * Validation function to be executed when record is deleted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateDelete(scriptContext) {

        }

        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {

        }

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // postSourcing: postSourcing,
            // sublistChanged: sublistChanged,
            // lineInit: lineInit,
            // validateField: validateField,
            // validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            // saveRecord: saveRecord
        };

    });
