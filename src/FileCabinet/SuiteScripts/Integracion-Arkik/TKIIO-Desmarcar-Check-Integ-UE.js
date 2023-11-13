/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 /**
 * @name Tkiio-Desmarcar-Check-Integ-UE
 * @version 1.0
 * @author Adrián Aguilar <adrian.aguilar@freebug.mx>
 * @summary Script que servirá para desmarcar el check de integrado en caso de editar un cliente
 * @copyright Tekiio México 2022
 * 
 * Client              -> Magno Concretos
 * Last modification   -> Fecha
 * Modified by         -> Adrián Aguilar <adrian.aguilar@freebug.mx>
 * Script in NS        -> Registro en Netsuite <ID del registro>
 */
define(['N/log', 'N/record'],
    /**
 * @param{log} log
 * @param{record} record
 */
    (log, record) => {
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
            try{

                if(scriptContext.type == scriptContext.UserEventType.EDIT || scriptContext.type == scriptContext.UserEventType.CREATE){
                    var newRecord = scriptContext.newRecord;
                    var id = newRecord.getValue({ fieldId: "id" });
                    log.debug({title: 'id', details: id});
                    var recordType = scriptContext.newRecord.type;
                    log.debug({title: 'record', details: recordType});
                    
                    if(recordType=='customer'){

                        record.submitFields({
                            type: recordType,
                            id: id,
                            values: {
                                'custentity_tkiio_arkik_integration': false,
                                'custentity_tkiio_arkik_status_client':''
                            }
                        });
                    }else{
                        record.submitFields({
                            type: recordType,
                            id: id,
                            values: {
                                'custitem_tkiio_arkik_integ_items': false,
                                'custitem_tkiio_status_arkik_item':''
                            }
                        });
                    }
                }
            }catch(error){
                log.error({title: 'error', details: error});
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
