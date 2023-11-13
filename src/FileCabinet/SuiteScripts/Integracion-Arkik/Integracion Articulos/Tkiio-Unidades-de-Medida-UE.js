/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 /**
 * @name Tkiio-Unidades-de-Medida-UE
 * @version 1.0
 * @author Adrián Aguilar <adrian.aguilar@freebug.mx>
 * @summary Script que servirá para llenar el campo de unidades de medida Arkik. Puesto que es necesario tener una abreviación
 *          específica para la sincronización con Arkik.
 * @copyright Tekiio México 2022
 * 
 * Client              -> Cliente
 * Last modification   -> Fecha
 * Modified by         -> Adrián Aguilar <adrian.aguilar@freebug.mx>
 * Script in NS        -> Registro en Netsuite <ID del registro>
 */
define(['N/currentRecord', 'N/log', 'N/record', 'N/search'],
    /**
 * @param{currentRecord} currentRecord
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */
    (currentRecord, log, record, search) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

                    log.debug('Registro', 'Tipo de Registro: ');
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            try {
                if (scriptContext.type === scriptContext.UserEventType.CREATE || scriptContext.type === scriptContext.UserEventType.EDIT) {
                    var recordType = scriptContext.newRecord.type;
                    var objRecord = scriptContext.newRecord;
                    log.debug('Registro', 'Tipo de Registro: ' + recordType);
                    if (recordType == 'inventoryitem') {
                        var stockUnit = objRecord.getText({ fieldId: 'stockunit' });
                        var purchaseUnit = objRecord.getText({ fieldId: 'purchaseunit' });

                        log.debug({ title: 'stockUnit', details: stockUnit });
                        log.debug({ title: 'purchaseUnit', details: purchaseUnit });

                        if (stockUnit == 'PIEZAS' || stockUnit == 'BOLSAS') {
                            objRecord.setValue({ fieldId: 'custitem_tkiio_unit_arkik', value: 'EA', ignoreFieldChange: false, forceSyncSourcing: true })
                        } else {
                            var abreviatura = obtainUnits(stockUnit);
                            objRecord.setValue({ fieldId: 'custitem_tkiio_unit_arkik', value: abreviatura, ignoreFieldChange: false, forceSyncSourcing: true })
                        }

                        if (purchaseUnit == 'PIEZAS' || purchaseUnit == 'BOLSAS') {
                            objRecord.setValue({ fieldId: 'custitem_tkiio_uom_base_arkik', value: 'EA', ignoreFieldChange: false, forceSyncSourcing: true })
                        } else {
                            var abreviatura = obtainUnits(purchaseUnit);
                            objRecord.setValue({ fieldId: 'custitem_tkiio_uom_base_arkik', value: abreviatura, ignoreFieldChange: false, forceSyncSourcing: true })
                        }


                    } else {
                        var subtipo = objRecord.getValue({ fieldId: 'subtype' });
                        if(subtipo == 'Sale'){

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
                            
                        }else{
                            
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
                log.error({ title: 'error', details: error });
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
                            search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Nombre" }),
                            search.createColumn({ name: "unitname", label: "Nombre de la unidad" })
                        ]
                });
                var searchResultCount = unitstypeSearchObj.runPaged().count;
                log.debug("unitstypeSearchObj result count", searchResultCount);

                var unit = '';
                unitstypeSearchObj.run().each(function (result) {
                    unit = result.getValue({ name: 'abbreviation' });
                    return true;
                });

                log.audit('abreviacion: ', unit);

                return unit;

            } catch (error) {
                log.error({title: 'error', details: error});
                return '';
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return { beforeLoad, beforeSubmit, afterSubmit }

    });
