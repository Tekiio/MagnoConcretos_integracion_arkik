/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/**
* @name TKIIO-Integracion-Articulos-MR
* @version 1.0
* @author Adrián Aguilar <adrian.aguilar@freebug.mx>
* @summary Script que servirá para sincronizar los artículos de Netsuite a Arkik
* @copyright Tekiio México 2022
* 
* Client              -> Magno Concretos
* Last modification   -> Fecha
* Modified by         -> Adrián Aguilar <adrian.aguilar@freebug.mx>
* Script in NS        -> Registro en Netsuite <ID del registro>
*/
define(['N/log', 'N/record', 'N/search', 'N/config', 'N/runtime', 'N/https'],
    /**
 * @param{log} log
 * @param{record} record
 */
    (log, record, search, config, runtime, https) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try {

                //Obtención de la moneda
                var companyConfig = config.load({ type: config.Type.COMPANY_INFORMATION });
                var moneda = companyConfig.getValue({ fieldId: 'basecurrency' });
                var currencyName = search.lookupFields({
                    type: search.Type.CURRENCY,
                    id: moneda,
                    columns: ['name']
                })
                var monedaNombre = currencyName.name || '';

                var itemPurchase = obtainItem(monedaNombre);
                log.debug({ title: 'itemPurchase', details: itemPurchase });
                return itemPurchase;
            } catch (error) {
                log.error({ title: 'error', details: error });
            }

        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            try {

                var value = JSON.parse(mapContext.value);
                log.audit({ title: 'Map item value', details: value });
                if (value.tipo == 'InvtPart'
                    || value.tipo == 'Kit'
                    || ((value.subtipo == 'Para la venta' || value.subtipo == 'For Sale'))
                    || ((value.subtipo == 'Para reventa' || value.subtipo == 'For Resale'))) {
                    //Obtendrá la información de los articulos de inventario, kit o fuera de inventario y/servicio para la venta
                    var objItem = obtainInventory(value.idInterno, value.moneda, value.subtipo);
                    log.audit({ title: 'objItem', details: objItem });
                    mapContext.write({
                        key: mapContext.key,
                        value: {
                            json: objItem
                        }
                    });
                } else if (value.subtipo == 'Para compra' || value.subtipo == 'For Purchase') {
                    var objNonInventory = obtainNonInventory(value.idInterno, value.moneda);
                    log.audit({ title: 'objNonInventory', details: objNonInventory });
                    mapContext.write({
                        key: mapContext.key,
                        value: {
                            json: objNonInventory
                        }
                    });
                } else {
                    mapContext.write({
                        key: mapContext.key,
                        value: ''
                    });
                }
            } catch (error) {
                log.error({ title: 'error map', details: error });
            }


        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

            try {
                var tipoRegistro = '';

                var sync = {
                    "actionCriteria": [
                        {
                            "actionExpression": [
                                {
                                    "value": "Syncronize"
                                }
                            ]
                        }
                    ],
                    "recordSetCompleteIndicator": false
                };

                var applicaArea = {
                    "sender": {
                        "componentID": {
                            "value": "Arkik Link"
                        },
                        "taskID": {
                            "value": "1"
                        },
                        "referenceID": {
                            "value": "CONTPAQi_010"
                        },
                        "confirmationCodes": {
                            "confirmationCode": {
                                "value": "Always"
                            }
                        }
                    },
                    "receiver": [
                        {
                            "logicalID": {
                                "value": "010"
                            },
                            "id": [
                                {
                                    "value": "010"
                                }
                            ]
                        }
                    ],
                    "bodid": {
                        "value": "71b6500b-07b5-4da7-90ae-c950e03ee00e" // TODO
                    }
                };

                var articulos = (JSON.parse(reduceContext.values[0]));

                switch ((articulos.json.tipo).toUpperCase()) {
                    case 'INVTPART':
                        tipoRegistro = record.Type.INVENTORY_ITEM;
                        break;
                    case 'SERVICE':
                        tipoRegistro = record.Type.SERVICE_ITEM;
                        break;
                    case 'NONINVTPART':
                        tipoRegistro = record.Type.NON_INVENTORY_ITEM;
                        break;
                    case 'KIT':
                        tipoRegistro = record.Type.KIT_ITEM;
                        break;
                }

                //Armado del JSON segun como lo requiere ARKIK.
                var json = {
                    dataArea: {
                        sync: sync,
                        itemMaster: [articulos.json],
                    },
                    applicationArea: applicaArea,
                    "versionID": "v10.6",
                    "systemEnvironmentCode": "Test",
                    "languageCode": "en-US"
                }

                //Credenciales para consumir la api
                var url = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_url_items' });
                var autorizacion = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_code_aut_items' });
                var apiKey = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_api_key_items' });

                // // Configurar los encabezados de la solicitud HTTPS
                var headers = {
                    Authorization: autorizacion,
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/json'
                };


                // if (json.dataArea.itemMaster[0].idInterno == '146' || json.dataArea.itemMaster[0].idInterno == '653') {//Validación que se puso para pruebas -QUITAR
                // var tipoRegistro = json.dataArea.itemMaster[0].tipo;
                var id = json.dataArea.itemMaster[0].idInterno;

                delete json.dataArea.itemMaster[0].idInterno;
                (json.dataArea.itemMaster[0].itemValue).forEach(element => {
                    delete element.idInterno;
                    delete element.tipo;

                });
                log.audit({ title: 'articulos', details: json });

                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(json)
                });

                var responseBody = response.body;
                var responseCode = response.code;

                log.debug({ title: 'responseBody', details: responseBody });
                log.debug({ title: 'responseCode', details: responseCode });

                if (responseCode === 200) {
                    log.debug('API Response', responseBody);
                    // log.debug({title: 'response.body', details:typeof response.body});
                    var objResponse = JSON.parse(responseBody);
                    log.debug({ title: 'objResponse', details: objResponse });
                    (objResponse.dataArea.bod).forEach(element => {
                        log.debug({ title: 'entre al forEach', details: 'entre al forEach' });
                        log.debug({ title: 'element.bodFailureMessage', details: element.bodFailureMessage });
                        log.debug({ title: 'element.bodSuccessMessage', details: element.bodSuccessMessage });
                        var arrDescription = [];

                        //Recorrido a los mensajes para poderlo setear en el campo correspondiente
                        if (element.bodFailureMessage) {
                            log.debug({ title: 'Entre al if', details: 'Entre al if' });
                            log.debug({ title: 'element.bodFailureMessage', details: element.bodFailureMessage.errorProcessMessage });
                            (element.bodFailureMessage.errorProcessMessage).forEach(element => {
                                // var mensaje = element.bodFailureMessage.errorProcessMessage;
                                log.debug({ title: 'element', details: element });
                                (element.description).forEach(mensaje => {
                                    // (mensaje.description).forEach(description => {
                                    arrDescription.push(mensaje.value);
                                    // });
                                });
                            });

                            var msj = arrDescription.join(',');
                            record.submitFields({
                                type: tipoRegistro,
                                id: id,
                                values: {
                                    'custitem_tkiio_arkik_integ_items': false,
                                    'custitem_tkiio_status_arkik_item': (element.bodFailureMessage.errorProcessMessage.length > 0 ? msj : 'Error no definido de Arkik')
                                }
                            });
                        } else if (element.bodSuccessMessage) {
                            log.debug({ title: 'Se actualizo correctamente', details: "Se actualizo correctamente" });
                            record.submitFields({
                                type: tipoRegistro,
                                id: id,
                                values: {
                                    'custitem_tkiio_arkik_integ_items': true,
                                    'custitem_tkiio_status_arkik_item': "El Artículo fue actualizado correctamente en Arkik. "
                                }
                            });
                        }
                    });
                } else {
                    log.error('API Error', 'Response code: ' + responseCode + ', Response body: ' + responseBody);
                    log.audit({ title: 'responseBody', details: responseBody });
                    log.audit({ title: 'responseBody', details: typeof responseBody });
                    let objErrors = JSON.parse(responseBody).errors;
                    log.audit({ title: 'objErrors', details: objErrors });
                    let msg = '';
                    for (let key in objErrors) {
                        log.audit({ title: 'key', details: key });
                        if (key.indexOf('ItemMaster.ID') !== -1) {
                            msg = 'Debe llenar el campo de UPC CODE'
                        }
                    }
                    record.submitFields({
                        type: tipoRegistro,
                        id: id,
                        values: {
                            'custitem_tkiio_arkik_integ_items': false,
                            'custitem_tkiio_status_arkik_item': (msg === '' ? "Ocurrio un error inesperado, consulte a su Administrador. " : msg)
                        }
                    });
                }

                // }


            } catch (error) {
                log.error({ title: 'error reduce', details: error });
            }

        }

        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            log.debug({ title: 'summaryContext', details: summaryContext });
        }

        function obtainNonInventory(id, moneda) {
            try {
                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                        [
                            ["subtype", "noneof", "Sale", "Resale"],
                            "AND",
                            ["type", "noneof", "InvtPart", "GiftCert", "Description", "Discount", "Payment", "Markup", "Kit"],
                            "AND",
                            ["internalid", "anyof", id],
                            "AND",
                            ["custitem_tkiio_arkik_integ_items", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Nombre" }),
                            search.createColumn({ name: "isinactive", label: "Inactivo" }),
                            search.createColumn({ name: "purchaseunit", label: "Unidad de compra principal" }),
                            search.createColumn({ name: "formulatext", formula: "{cost}", label: "Precio base" }),
                            search.createColumn({ name: "salesdescription", label: "Descripción" }),
                            search.createColumn({ name: "custitem_tkiio_class_arkik", label: "Clasificación Arkik" }),
                            search.createColumn({ name: "upccode", label: "Código UPC" }),
                            search.createColumn({ name: "custitem_tkiio_uom_base_arkik", label: "UOM Base Arkik" }),
                            search.createColumn({ name: "custitem_tkiio_unit_arkik", label: "UOM Stock Arkik" }),
                            search.createColumn({ name: "internalid", label: "ID interno" }),
                            search.createColumn({ name: "type", label: "Tipo de registro" }),
                            search.createColumn({ name: "custrecord_tkiio_class_abbrev_arkik", join: "CUSTITEM_TKIIO_CLASS_ARKIK", label: "Abreviación" })
                        ]
                });

                const ALL_ARKIR_LOCATIONS = getAllArkikLocations();

                var objNonInventory = {};

                itemSearchObj.run().each(function (result) {
                    objNonInventory = {
                        "idInterno": result.getValue({ name: 'internalid' }),
                        "tipo": result.getValue({ name: 'type' }),
                        "supplierParty": [],
                        "locationItemMaster": ALL_ARKIR_LOCATIONS,
                        "itemStatus": {
                            "description": {
                                "value": (result.getValue({ name: 'isinactive' }) == false) ? 'Active' : 'Inactive'
                            }
                        },
                        "baseUOMCode": {
                            "value": result.getValue({ name: 'custitem_tkiio_uom_base_arkik' })
                        },
                        "storageUOMCode": {
                            "value": result.getValue({ name: 'custitem_tkiio_unit_arkik' })
                        },
                        "itemValue": [{
                            "unitValue": {
                                "basisQuantity": {
                                    "value": 1//Valor que siempre será uno
                                },
                                "unitAmount": {
                                    "currencyCode": moneda,
                                    "value": result.getValue({ name: "formulatext", formula: "{cost}" }) || 0
                                }
                            }
                        }
                        ],
                        "description": [
                            {
                                "value": result.getValue({ name: 'salesdescription' })
                            }
                        ],
                        "classification": [
                            {
                                "codes": [
                                    {
                                        "value": result.getValue({ name: "custrecord_tkiio_class_abbrev_arkik", join: "CUSTITEM_TKIIO_CLASS_ARKIK" })
                                    }
                                ]
                            }
                        ],
                        "serviceIndicator": false,
                        "id": {
                            "value": result.getValue({ name: 'itemid' })
                        }
                    }
                    return true;
                });


                return objNonInventory;
            } catch (error) {
                log.error({ title: 'error obtainNonInventory', details: error });
            }
        }
        /**
         * @summary Función que obtendrá todos los artículos
         * @param {*} moneda 
         * @returns 
         */
        function obtainItem(moneda) {
            try {

                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                        [
                            // ["internalid", "anyof", "145"],
                            // "AND",
                            ["type", "noneof", "GiftCert", "Description", "Discount", "OthCharge", "Payment", "Markup", "Subtotal"],
                            "AND",
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "ID interno" }),
                            search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Nombre" }),
                            search.createColumn({ name: "type", label: "tipo" }),
                            search.createColumn({ name: "subtype", label: "Subtipo" }),
                        ]
                });

                var myPagedResults = itemSearchObj.runPaged({
                    pageSize: 1000
                });
                var thePageRanges = myPagedResults.pageRanges;

                var articulos = [];
                for (var i in thePageRanges) {
                    var thepageData = myPagedResults.fetch({ index: thePageRanges[i].index });
                    thepageData.data.forEach(function (result) {

                        var objArticulos = {
                            "idInterno": result.getValue({ name: 'internalid' }),
                            "itemid": result.getValue({ name: 'itemid' }),
                            "tipo": result.getValue({ name: 'type' }),
                            "subtipo": result.getValue({ name: 'subtype' }),
                            "moneda": moneda
                        }

                        articulos.push(objArticulos);
                        return true;
                    })
                }

                log.debug({ title: 'articulos cantidad: ', details: articulos.length });
                return articulos;
            } catch (error) {
                log.error({ title: 'error', details: error });
                return [];
            }
        }

        /**
         * @summary Función que servirá para traer los datos de los artículos inventariables
         * @param {*} id 
         * @param {*} moneda 
         * @returns 
         */
        function obtainInventory(id, moneda, subtipo) {
            try {

                var filtros, columnas;
                log.audit({ title: 'subtipo', details: subtipo });
                log.audit({ title: 'typeof subtipo', details: typeof subtipo });
                if ((subtipo == 'Para la venta' || subtipo == 'For Sale') || (subtipo == 'Para reventa' || subtipo == 'For Resale')) {

                    filtros = [
                        ["type", "anyof", "NonInvtPart", "Service"],
                        "AND",
                        ["subtype", "anyof", "Sale", "Resale"],
                        "AND",
                        ["internalid", "anyof", id],
                        "AND",
                        ["custitem_tkiio_arkik_integ_items", "is", "F"]
                    ];
                    columnas = [
                        search.createColumn({ name: "internalid", label: "ID interno" }),
                        search.createColumn({ name: "isinactive", label: "Inactivo" }),
                        search.createColumn({ name: "custitem_tkiio_uom_base_arkik", label: "UOM Base Arkik" }),
                        search.createColumn({ name: "custitem_tkiio_unit_arkik", label: "UOM Stock Arkik" }),
                        search.createColumn({ name: "salesdescription", label: "Descripción" }),
                        search.createColumn({ name: "custitem_tkiio_class_arkik", label: "Clasificación Arkik" }),
                        search.createColumn({ name: "type", label: "Tipo de registro" }),
                        search.createColumn({ name: "type", label: "itemid" })
                    ]
                } else {
                    filtros = [
                        ["type", "anyof", "InvtPart", "Kit"],
                        "AND",
                        ["internalid", "anyof", id]
                    ]
                    columnas = [
                        search.createColumn({ name: "internalid", label: "ID interno" }),
                        search.createColumn({ name: "isinactive", label: "Inactivo" }),
                        search.createColumn({ name: "custitem_tkiio_uom_base_arkik", label: "UOM Base Arkik" }),
                        search.createColumn({ name: "custitem_tkiio_unit_arkik", label: "UOM Stock Arkik" }),
                        search.createColumn({ name: "salesdescription", label: "Descripción" }),
                        search.createColumn({ name: "custitem_tkiio_class_arkik", label: "Clasificación Arkik" }),
                        search.createColumn({ name: "upccode", label: "Código UPC" }),
                        search.createColumn({ name: "type", label: "Tipo de registro" }),
                        search.createColumn({ name: "custrecord_tkiio_class_abbrev_arkik", join: "CUSTITEM_TKIIO_CLASS_ARKIK", label: "Abreviación" })
                    ]
                }

                var itemSearchObj = search.create({
                    type: "item",
                    filters: filtros,
                    columns: columnas
                });

                var objItem = {};

                itemSearchObj.run().each(function (result) {
                    log.audit({ title: 'UPC_CODE', details: result.getValue({ name: 'upccode' }) });
                    objItem = {
                        "idInterno": result.getValue({ name: 'internalid' }),
                        "tipo": result.getValue({ name: 'type' }),
                        "supplierParty": [],
                        "locationItemMaster": [],
                        "itemStatus": {
                            "description": {
                                "value": (result.getValue({ name: 'isinactive' }) == false) ? 'Active' : 'Inactive'
                            }
                        },
                        "baseUOMCode": {
                            "value": result.getValue({ name: 'custitem_tkiio_uom_base_arkik' })
                        },
                        "storageUOMCode": {
                            "value": result.getValue({ name: 'custitem_tkiio_unit_arkik' })
                        },
                        "itemValue": [
                        ],
                        "description": [
                            {
                                "value": result.getValue({ name: 'salesdescription' })
                            }
                        ],
                        "classification": [
                            {
                                "codes": [
                                    {
                                        "value": result.getValue({ name: "custrecord_tkiio_class_abbrev_arkik", join: "CUSTITEM_TKIIO_CLASS_ARKIK" })

                                    }
                                ]
                            }
                        ],
                        "serviceIndicator": false,
                        "id": {
                            "value": (subtipo == '') ? result.getValue({ name: 'upccode' }) : search.createColumn({ name: "type", label: "itemid" })
                        }

                    }
                    return true;
                });

                var costosItem = obtainCostos(id);//Obtención de la moneda base y sus costos

                costosItem.forEach(element => {//Como no todos los artículos tienen moneda y costo, hace una busqueda para encontrar el artículo configurado con su precio
                    if (element.idInterno == objItem.idInterno) {
                        (objItem.itemValue).push(element)
                    }
                });

                if ((objItem.itemValue).length == 0) {//Recorrido al item para ver si tiene algo en las monedas
                    var objValue = {
                        "unitValue": {
                            "basisQuantity": {
                                "value": 1 //Valor que siempre será uno
                            },
                            "unitAmount": {
                                "currencyCode": moneda,
                                "value": 0
                            }
                        }
                    };
                    (objItem.itemValue).push(objValue);
                }

                if (subtipo == '') {
                    var ubicaciones = obtainLocation(id);//Obtención de la ubicación de los artículo
                    ubicaciones.forEach(element => {
                        (objItem.locationItemMaster).push(element);
                    });
                }

                if (objItem.tipo && -1 !== ['kit', 'noninvtpart', 'service'].indexOf(objItem.tipo.toLowerCase())) {
                    objItem.locationItemMaster = getAllArkikLocations();
                }

                return objItem;
            } catch (error) {
                log.error({ title: 'error', details: error });
                return '';
            }
        }


        /**
         * @summary Función que obtendrá los costos y la moneda de los artículos inventariables o de kit
         * @param {*} arrIdItems 
         * @returns 
         */
        function obtainCostos(id) {
            try {
                // log.debug({ title: 'arrIdItems', details: id });
                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                        [
                            ["pricing.pricelevel", "anyof", "1"],
                            "AND",
                            ["type", "noneof", "Description", "Discount", "Markup", "Payment", "OthCharge"],
                            "AND",
                            ["pricing.assignedpricelevel", "is", "F"],
                            "AND",
                            ["internalid", "anyof", id]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", summary: "GROUP", label: "ID interno" }),
                            search.createColumn({ name: "itemid", summary: "GROUP", sort: search.Sort.ASC, label: "Nombre" }),
                            search.createColumn({ name: "currency", join: "pricing", summary: "GROUP", label: "Moneda" }),
                            search.createColumn({ name: "unitprice", join: "pricing", summary: "GROUP", label: "Precio unitario" }),
                            search.createColumn({ name: "pricelevel", join: "pricing", summary: "GROUP", label: "Nivel de precio" })
                        ]
                });

                var arrCostos = [];
                itemSearchObj.run().each(function (result) {
                    var objCostos = {
                        "idInterno": result.getValue({ name: 'internalid', summary: "GROUP" }),
                        "unitValue": {
                            "basisQuantity": {
                                "value": 1//Valor que siempre será uno
                            },
                            "unitAmount": {
                                "currencyCode": result.getText({ name: 'currency', join: 'pricing', summary: "GROUP" }),
                                "value": result.getValue({ name: 'unitprice', join: 'pricing', summary: "GROUP" }) || 0
                            }
                        }
                    }
                    arrCostos.push(objCostos);
                    return true;
                });
                // log.debug({ title: 'arrCostos', details: arrCostos });
                return arrCostos;
            } catch (error) {
                log.error({ title: 'error', details: error });
                return []
            }
        }

        const getAllArkikLocations = () => {
            try {
                let arrUbicaciones = []

                search.create({
                    type: search.Type.LOCATION,
                    filters: [
                        ['custrecord_tkiio_code_locat_arkik', search.Operator.ISNOTEMPTY, '']
                    ],
                    columns: ['custrecord_tkiio_code_locat_arkik'],
                }).run().each(function (result) {

                    arrUbicaciones.push({
                        "serviceIndicator": false,
                        "id": {
                            "value": result.getValue({ name: 'custrecord_tkiio_code_locat_arkik' }) || ''
                        }
                    });
                    return true;
                });

                return arrUbicaciones;
            } catch (error) {
                log.error('error:', error);
            }
        }

        /**
         * @summary Función que obtendrá las ubicaciones con su respectivo código arkik de cada artículo inventariable
         * @param {*} id 
         */
        function obtainLocation(id) {
            try {
                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                        [
                            ["internalid", "anyof", id],
                            "AND",
                            ["inventorylocation.custrecord_tkiio_code_locat_arkik", "isnotempty", ""]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Nombre" }),
                            search.createColumn({ name: "type", label: "Tipo" }),
                            search.createColumn({ name: "subtype", label: "Subtipo" }),
                            search.createColumn({ name: "custrecord_tkiio_code_locat_arkik", join: "inventoryLocation", label: "Código Ubicación Arkik" }),
                            search.createColumn({ name: "locationquantityonhand", label: "Físico en ubicación" })
                        ]
                });
                var arrUbicaciones = []
                itemSearchObj.run().each(function (result) {
                    var objUbicaciones = {
                        "serviceIndicator": false,
                        "id": {
                            "value": result.getValue({ name: 'custrecord_tkiio_code_locat_arkik', join: "inventoryLocation" }) || ''
                        }
                    }
                    arrUbicaciones.push(objUbicaciones);
                    return true;
                });
                return arrUbicaciones;
            } catch (error) {
                log.error({ title: 'error obtainLocation', details: error });
                return [];
            }
        }

        return { getInputData, map, reduce, summarize }

    });
