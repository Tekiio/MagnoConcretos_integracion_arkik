/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/**
* @name TKIIO - Integracin - Pedidos - MR
* @version 1.0
* @author Adrián Aguilar <adrian.aguilar@freebug.mx>
* @summary Script que servirá para obtener los movimientos desde arkik y crear las transacciones en Netsuite
* @copyright Tekiio México 2022
* 
* Client              -> Magno Concretos
* Last modification   -> Fecha
* Modified by         -> Adrián Aguilar <adrian.aguilar@freebug.mx>
* Script in NS        -> Registro en Netsuite <ID del registro>
*/
define(['N/log', 'N/search', 'N/runtime', 'N/format', 'N/https', '../moment', 'N/record', 'N/transaction', 'N/file'],
    /**
 * @param{log} log
 * @param{search} search
 */
    (log, search, runtime, format, https, moment, record, transaction, file) => {
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
                var startDate = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_integ_ped_date_start' });
                log.debug('getInputData : startDate:', startDate);
                var finalDate = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_integ_ped_date_end' });
                log.debug('getInputData : finalDate:', finalDate);

                var formattedStartDate = '';
                var formattedEndDate = '';

                if (startDate && finalDate) {

                    var originalStartDate = startDate.toString();
                    var dateStartObj = new Date(originalStartDate);
                    dateStartObj.setUTCHours(0, 0, 0, 0);
                    formattedStartDate = dateStartObj.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');

                    var originalEndDate = finalDate.toString();
                    var dateEndObj = new Date(originalEndDate);
                    dateEndObj.setUTCHours(23, 59, 59, 59);
                    formattedEndDate = dateEndObj.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');

                } else {//Else, take the actual date of the script execution
                    var date = formatDate();
                    formattedStartDate = date.dateStart;
                    formattedEndDate = date.dateEnd;
                }
                var plants = obtainPlants();//Obtain the plants configured in their instance

                log.debug({ title: 'Fechas', details: { formattedStartDate, formattedEndDate } });
                var jsonRequest = {
                    "dataArea": {
                        "get": {
                            "uniqueIndicator": false,
                            "recordSetSaveIndicator": false,
                            "expression": [
                                {
                                    "value": "*"
                                }
                            ]
                        },
                        "shipment": [
                            {
                                "shipmentHeader": {
                                    "carrierRouteReference": [
                                        {
                                            "productionOrderReference": [
                                                {
                                                    "facility": [
                                                        {
                                                            "id": plants,
                                                            "typeCode": "Plant"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ],
                                    "estimatedArrivalDateTime": {
                                        "value": formattedStartDate
                                    }
                                }
                            },
                            {
                                "shipmentHeader": {
                                    "estimatedArrivalDateTime": {
                                        "value": formattedEndDate
                                    }
                                }
                            }
                        ]
                    },
                    "applicationArea": {
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
                            "value": "77a1beda-3ae5-403b-b2e5-b20c14430d08"
                        }
                    },
                    "systemEnvironmentCode": "Production",
                    "languageCode": "en-US"
                }

                //Obtain all the parameters of conection with Arkik
                var url = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_url_pedidos' });
                var autorizacion = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_code_aut_pedidos' });
                var apiKey = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_api_key_pedidos' });

                // // CConfigure the necesary headers
                var headers = {
                    "Accept": 'application/json',
                    Authorization: autorizacion,
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/json',
                };

                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(jsonRequest)
                });

                log.audit({ title: 'jsonRequest', details: jsonRequest });
                var responseBody = response.body;
                var responseCode = response.code;
                var data = '';
                log.debug({ title: 'responseCode', details: responseCode });
                //if the request is succefully, enter here
                if (responseCode == 200) {

                    responseBody = JSON.parse(response.body)
                    data = responseBody.dataArea.shipment || [];

                    log.audit({ title: 'Shipments', details: data });
                    // guardaResponse(responseBody)
                    if (0 < data.length) {
                        log.audit({ title: 'data[0].shipmentHeader', details: data[0].shipmentHeader });
                        data.forEach(dato => {
                            // log.audit({ title: 'pedido estatus', details: dato.shipmentHeader.status });
                            // log.audit({ title: 'pedido estatus', details: dato.shipmentHeader.id });
                            // log.audit({ title: 'pedido shipmentItem', details: dato.shipmentItem[0] });
                        })
                        log.audit({ title: 'data.length', details: data.length });
                        return data;
                    }
                }
                return []
            } catch (error) {
                log.error({ title: 'error getInputData: ', details: error });
            }

        }
        function guardaResponse(data) {
            try {
                let bankFile = file.create({
                    name: 'Data_response.json',
                    fileType: file.Type.JSON,
                    contents: data,
                    // encoding: file.Encoding.UTF_8,
                    folder: 25010,
                    isOnline: false
                }).save();
            } catch (e) {
                log.error({ title: 'Error guardaResponse:', details: e });
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
                let value = JSON.parse(mapContext.value);
                // let data = value.shipmentHeader;
                // log.debug({title: 'data', details: data});
                // if (value.shipmentHeader.id.value == 'P001756') {//QUITAAAR

                createTransaction(value);
                // }

            } catch (error) {
                log.error({ title: 'error Map', details: error });
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

        function createTransaction(value) {//CHANGE FOR VALUE
            var objTran = {};
            try {
                //VARIABLE DE PRUEBAS QUE SE TIENE QUE QUITAR
                // var value = {
                //     "shipmentHeader": {
                //         "salePriceAmount": {
                //             "value": 0
                //         },
                //         "shipmentTotalAmount": {
                //             "value": 0
                //         },
                //         "requiredDeliveryDateTime": {
                //             "value": ""
                //         },
                //         "loadingDateTime": {
                //             "value": "2022-12-30 12:22:01Z"
                //         },
                //         "priorityCode": {
                //             "value": "1"
                //         },
                //         "disposition": {
                //             "code": {
                //                 "value": "5"
                //             }
                //         },
                //         "event": [
                //             {
                //                 "code": {
                //                     "value": "Completada - Partida"
                //                 }
                //             }
                //         ],
                //         "shipUnitQuantity": {
                //             "unitCode": "M3",
                //             "value": 7.0
                //         },
                //         "carrierRouteReference": [
                //             {
                //                 "productionOrderReference": [
                //                     {
                //                         "facility": [
                //                             {
                //                                 "id": [
                //                                     {
                //                                         "value": "P001"
                //                                     }
                //                                 ],
                //                                 "typeCode": "Plant"
                //                             }
                //                         ],
                //                         "description": [
                //                             {
                //                                 "typeCode": "OrderTypeCode",
                //                                 "value": "ZBVV"
                //                             },
                //                             {
                //                                 "typeCode": "OrderTypeDesc",
                //                                 "value": "Normal Arkik"
                //                             }
                //                         ]
                //                     }
                //                 ]
                //             }
                //         ],
                //         "deliveryReference": [
                //             {
                //                 "id": {
                //                     "value": "A00002"
                //                 }
                //             }
                //         ],
                //         "actualShipDateTime": {
                //             "value": ""
                //         },
                //         "scheduledDeliveryDateTime": {
                //             "value": "2022-12-30 13:50:00Z"
                //         },
                //         "actualDeliveryDateTime": {
                //             "value": ""
                //         },
                //         "countryOfOriginCode": {
                //             "value": "MX"
                //         },
                //         "transportationMethodCode": {
                //             "value": "TRUCK"
                //         },
                //         "estimatedDepartureDateTime": {
                //             "value": "2022-12-30 13:03:00Z"
                //         },
                //         "estimatedArrivalDateTime": {
                //             "value": "2022-12-30 15:17:00Z"
                //         },
                //         "purchasingParty": {
                //             "buyerContact": {
                //                 "personName": [
                //                     {
                //                         "givenName": {
                //                             "value": "ROBERTO  ROBERTO "
                //                         },
                //                         "middleName": [
                //                             {
                //                                 "value": "2RAMIRO CANTU"
                //                             }
                //                         ],
                //                         "familyName": [
                //                             {
                //                                 "value": "."
                //                             }
                //                         ]
                //                     }
                //                 ],
                //                 "id": [
                //                     {
                //                         "value": "18"
                //                     }
                //                 ]
                //             },
                //             "accountID": [
                //                 {
                //                     "value": "CLI730"
                //                 }
                //             ],
                //             "name": [
                //                 {
                //                     "typeCode": "Name1",
                //                     "value": "MEX MIX COMERCIALIZADORA,"
                //                 },
                //                 {
                //                     "typeCode": "Name2",
                //                     "value": "SA DE CV"
                //                 }
                //             ],
                //             "contact": [
                //                 {
                //                     "telephoneCommunication": [
                //                         {
                //                             "dialNumber": {
                //                                 "value": "8113721712"
                //                             }
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "taxID": [
                //                 {
                //                     "value": "MMC130717LL0"
                //                 }
                //             ]
                //         },
                //         "shipToParty": [
                //             {
                //                 "name": [
                //                     {
                //                         "value": "MAQUILA"
                //                     },
                //                     {
                //                         "value": "--EMPTY--"
                //                     }
                //                 ],
                //                 "location": [
                //                     {
                //                         "address": [
                //                             {
                //                                 "buildingNumber": {
                //                                     "value": "000"
                //                                 },
                //                                 "streetName": {
                //                                     "value": "NA"
                //                                 },
                //                                 "cityName": {
                //                                     "value": "NA"
                //                                 },
                //                                 "citySubDivisionName": [
                //                                     {
                //                                         "typeCode": "CoName",
                //                                         "value": "CENTRO"
                //                                     },
                //                                     {
                //                                         "typeCode": "District",
                //                                         "value": "--EMPTY--"
                //                                     }
                //                                 ],
                //                                 "postalCode": {
                //                                     "value": "64000"
                //                                 },
                //                                 "geographicalCoordinate": [
                //                                     {
                //                                         "latitudeMeasure": {
                //                                             "value": 25.726406
                //                                         },
                //                                         "longitudeMeasure": {
                //                                             "value": -100.3119038
                //                                         }
                //                                     }
                //                                 ],
                //                                 "typeCode": "JS"
                //                             },
                //                             {
                //                                 "buildingNumber": {
                //                                     "value": "000"
                //                                 },
                //                                 "streetName": {
                //                                     "value": "NA"
                //                                 },
                //                                 "cityName": {
                //                                     "value": "NA"
                //                                 },
                //                                 "citySubDivisionName": [
                //                                     {
                //                                         "typeCode": "CoName",
                //                                         "value": "CENTRO"
                //                                     },
                //                                     {
                //                                         "typeCode": "District",
                //                                         "value": "--EMPTY--"
                //                                     }
                //                                 ],
                //                                 "postalCode": {
                //                                     "value": "64000"
                //                                 },
                //                                 "geographicalCoordinate": [
                //                                     {
                //                                         "latitudeMeasure": {
                //                                             "value": 25.726406
                //                                         },
                //                                         "longitudeMeasure": {
                //                                             "value": -100.3119038
                //                                         }
                //                                     }
                //                                 ],
                //                                 "typeCode": "POD"
                //                             }
                //                         ]
                //                     }
                //                 ],
                //                 "contact": [
                //                     {
                //                         "personName": [
                //                             {
                //                                 "givenName": {
                //                                     "value": "ROBERTO  ROBERTO "
                //                                 },
                //                                 "middleName": [
                //                                     {
                //                                         "value": "2RAMIRO CANTU"
                //                                     }
                //                                 ],
                //                                 "familyName": [
                //                                     {
                //                                         "value": "."
                //                                     }
                //                                 ]
                //                             }
                //                         ],
                //                         "telephoneCommunication": [
                //                             {
                //                                 "dialNumber": {
                //                                     "value": "8113721712"
                //                                 }
                //                             }
                //                         ],
                //                         "id": [
                //                             {
                //                                 "value": "18"
                //                             }
                //                         ]
                //                     }
                //                 ],
                //                 "id": [
                //                     {
                //                         "typeCode": "JS",
                //                         "value": "2000000017"
                //                     },
                //                     {
                //                         "typeCode": "POD",
                //                         "value": "2000000017"
                //                     }
                //                 ]
                //             }
                //         ],
                //         "status": [
                //             {
                //                 "code": {
                //                     "value": "4"
                //                 }
                //             }
                //         ],
                //         "lastModificationDateTime": {
                //             "value": "2022-12-30 18:18:07Z"
                //         },
                //         "id": {
                //             "value": "P001756"
                //         }
                //     },
                //     "shipmentItem": [
                //         {
                //             "unitSalePriceAmount": {
                //                 "currencyCode": "MXN",
                //                 "value": 0.0
                //             },
                //             "quantity": [
                //                 {
                //                     "unitCode": "M3",
                //                     "value": 2.5
                //                 }
                //             ],
                //             "description": [
                //                 {
                //                     "typeCode": "ProductCode",
                //                     "value": "94"
                //                 },
                //                 {
                //                     "typeCode": "ProductDescription",
                //                     "value": "1-250-2-C-28-12-0-1-100"
                //                 },
                //                 {
                //                     "typeCode": "ProductShortDescription",
                //                     "value": "1-250-2-C-28-12-0-1-100"
                //                 },
                //                 {
                //                     "typeCode": "CommercialCode",
                //                     "value": "1234"
                //                 },
                //                 {
                //                     "typeCode": "CommercialDescription",
                //                     "value": "250-20-12TD8                                                                                                                                                                                                                                                   "
                //                 },
                //                 {
                //                     "typeCode": "CommercialShortDescription",
                //                     "value": "250-20-12TD8"
                //                 }
                //             ],
                //             "classification": [
                //                 {
                //                     "description": [
                //                         {
                //                             "value": "Producto Técnico Concreto"
                //                         }
                //                     ],
                //                     "id": [
                //                         {
                //                             "value": "TECH"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "countryOfOriginCode": {
                //                 "value": "MX"
                //             },
                //             "serviceIndicator": false,
                //             "supplierItemIdentification": {
                //                 "id": {
                //                     "value": "L001"
                //                 }
                //             },
                //             "id": {
                //                 "value": "945"
                //             }
                //         }
                //     ]
                // }

                // En caso de que la transaccion no coincida con lo que se tenga en Netsuite, creara una a partir de la informacion que provee arkik
                // var idTransaction = value.shipmentHeader.id.value;
                var idTransaction = value.shipmentHeader.deliveryReference[0].id.value;
                log.emergency({ title: 'value', details: value });
                //Devuelve un arreglo en el que la primer posicion es el numero de transacciones encontradas y el segundo es el resultado de la busqueda
                var searchTransaction = searchTransactions(idTransaction);
                var countTransaction = searchTransaction[0];
                log.debug({ title: 'countTransaction', details: countTransaction });
                //Si no hay transacciones generara una con la informacion obtenida de la petición
                if (countTransaction == 0 && value.shipmentHeader.status[0].code.value === 'CMPL') {

                    let dateTransaction = value.shipmentHeader.loadingDateTime.value;
                    let date = moment.utc(dateTransaction).format('DD/MM/YYYY');
                    let fechaFormateada = format.parse({ value: date, type: format.Type.DATE });
                    let client = value.shipmentHeader.purchasingParty.name[0].value;
                    // let client = value.shipmentHeader.purchasingParty.accountID[0].value;
                    log.debug({ title: 'Client accountID', details: value.shipmentHeader.purchasingParty });
                    log.debug({ title: 'Client', details: client });
                    let clientId = searchClient(client);

                    if (clientId !== '') {
                        let arrItems = [];
                        let arrObjItem = [];
                        (value.shipmentItem).forEach(item => {
                            log.debug({ title: 'item', details: item });
                            log.debug({ title: 'Clasificacion', details: item.classification[0].id[0].value });
                            if (item.classification[0].id[0].value === 'TECH') {
                                var itemId = (item.classification[0].id[0].value === 'TECH' ? item.description[3].value : item.description[0].value)
                                arrItems.push(itemId);
                                let objItem = {
                                    sku: itemId,
                                    quantity: item.quantity[0].value
                                }
                                arrObjItem.push(objItem)
                            }
                        });
                        let itemsID = searchItems(arrItems);

                        arrObjItem.forEach(obj2 => {//Search every sku with his internalid in netsuite
                            const skuToMatch = obj2.sku;
                            const matchingObj = itemsID.find(obj1 => obj1.sku === skuToMatch);
                            obj2.internalid = matchingObj ? matchingObj.id : "";
                        });
                        if (arrObjItem.length != 0 && clientId) {
                            let salesOrder = record.create({
                                type: record.Type.SALES_ORDER,
                                isDynamic: true
                            });
                            log.debug({ title: 'Datos para la transaccion', details: { clientId, client, fechaFormateada, idTransaction } });
                            objTran = {
                                clientId, 
                                client, 
                                fechaFormateada, 
                                idTransaction,
                                arrObjItem
                            }
                            salesOrder.setValue({
                                fieldId: 'entity',
                                value: clientId, // ID interno del cliente asociado a la orden de venta
                            });

                            salesOrder.setValue({
                                fieldId: 'trandate',
                                value: fechaFormateada, // Fecha de la orden de venta (puedes personalizarla según tus necesidades)
                            });

                            salesOrder.setValue({
                                fieldId: "custbody_tkiio_id_trans_arkik",
                                value: idTransaction, // Fecha de la orden de venta (puedes personalizarla según tus necesidades)
                            });



                            arrObjItem.forEach(function (item) {

                                log.debug({ title: 'item', details: item });
                                salesOrder.selectNewLine({
                                    sublistId: 'item'
                                });
                                salesOrder.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    value: item.internalid, // ID interno del artículo actual
                                });
                                salesOrder.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    value: item.quantity, // Cantidad del artículo actual
                                });
                                // Establecer otros campos y valores relevantes para el artículo actual
                                salesOrder.commitLine({ sublistId: 'item' });
                            });

                            var salesOrderId = salesOrder.save({
                                enableSourcing: false,
                                ignoreMandatoryFields: true,
                            });
                            log.debug({ title: 'salesOrderId', details: salesOrderId });
                        } else {
                            log.debug({ title: 'No se pudo generar la transacción, no existen artículos y/o algun cliente', details: 'No se pudo generar la transacción, no existen artículos y/o algun cliente' });
                        }

                    }
                } else {
                    log.debug({ title: 'Se encontro alguna otra transacción con su respectivo ID', details: 'Se encontro alguna otra transacción con su respectivo ID [ ' + idTransaction + ' ]' });
                    // Verifica si se desea cancelar de lo contrario no hara la modificacion
                    if (value.shipmentHeader.status[0].code.value === 'CNCL') {
                        let searchObj = searchTransaction[1]
                        var myPagedResults = searchObj.runPaged({
                            pageSize: 1000
                        });

                        var thePageRanges = myPagedResults.pageRanges;
                        for (var i in thePageRanges) {
                            var thepageData = myPagedResults.fetch({
                                index: thePageRanges[i].index
                            });
                            thepageData.data.forEach(function (result) {
                                var transactionToUpdate = record.load({ type: record.Type.SALES_ORDER, id: result.id, isDynamic: true, });
                                let lineCountIF = transactionToUpdate.getLineCount({ sublistId: 'links' });

                                if (lineCountIF === 0) {
                                    // Funcion para cancelar la orden de venta, despues de verificar que no tenga ninguna transaccion relacionada
                                    var voidSalesOrderId = transaction.void({ type: transaction.Type.SALES_ORDER, id: result.id });
                                }
                            })
                        }
                    }
                }

            } catch (error) {
                log.error({ title: 'error createTransaction', details: {error, objTran} });
            }
        }

        /**
         * @summary Function that search the internal id of the items
         * @param {*} items 
         * @returns 
         */
        const searchItems = (items) => {
            try {
                log.debug({ title: 'arrItems', details: items });
                var itemSearchObj = search.create({
                    type: search.Type.ITEM,
                    filters:
                        [
                            ["upccode", search.Operator.IS, items]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Name" }),
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "upccode", label: "UPC Code" })
                        ]
                });

                let arrItems = [];
                itemSearchObj.run().each(function (result) {
                    let objItems = {
                        id: result.getValue({ name: 'internalid' }) || '',
                        name: result.getValue({ name: 'itemid' }) || '',
                        sku: result.getValue({ name: 'upccode' })
                    }
                    arrItems.push(objItems);
                    return true;
                });
                return arrItems;
            } catch (error) {
                log.error({ title: 'error searchItems', details: error });
            }
        }
        /**
         * @summary Function that search the internalid of the client.
         * @param {*} client 
         * @returns 
         */
        const searchClient = (client) => {
            log.debug('searchClient : client:', client);
            try {
                var customerSearchObj = search.create({
                    type: search.Type.CUSTOMER,
                    filters:
                        [
                            ["altname", search.Operator.IS, client]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "altname", sort: search.Sort.ASC, label: "ID" }),
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });
                var searchResultCount = customerSearchObj.runPaged().count;
                log.debug("customerSearchObj result count", searchResultCount);
                let internalid = '';
                customerSearchObj.run().each(function (result) {
                    let accountId = result.getValue({ name: 'altname' })
                    if (accountId === client) {
                        internalid = result.getValue({ name: 'internalid' })
                    }
                    return true;
                });
                log.debug({ title: 'ID del cliente:', details: internalid });
                return internalid;
            } catch (error) {
                log.error({ title: 'error searchClient', details: error });
                return '';
            }
        }

        /**
         * @summary Function that search if exist a transaction with the id of arkik
         * @param {*} idTransaction 
         * @returns 
         */
        const searchTransactions = (idTransaction) => {
            try {
                log.debug({ title: 'idTransaction', details: idTransaction });
                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters:
                        [
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["mainline", "is", "T"],
                            "AND",
                            ["custbody_tkiio_id_trans_arkik", "is", idTransaction]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "entity", label: "Name" }),
                            search.createColumn({ name: "internalid", label: "ID Interno" })
                        ]

                });
                var searchResultCount = salesorderSearchObj.runPaged().count;
                log.debug("salesorderSearchObj result count", searchResultCount);

                return [searchResultCount, salesorderSearchObj];
            } catch (error) {
                log.error({ title: 'error searchTransactions', details: error });
            }
        }

        /**
         * @summary Function that format the date to the desired format
         * @returns the date with the disired format
         */
        const formatDate = () => {
            try {
                var currentDateTime = new Date();
                var finalDateTime = new Date();
                currentDateTime.setUTCHours(0, 0, 0, 0);
                finalDateTime.setUTCHours(23, 59, 59, 59);
                // Obtener los componentes de fecha y hora
                var year = currentDateTime.getUTCFullYear();
                var month = ('0' + (currentDateTime.getUTCMonth() + 1)).slice(-2);
                var day = ('0' + currentDateTime.getUTCDate()).slice(-2);
                var hours = ('0' + currentDateTime.getUTCHours()).slice(-2);
                var minutes = ('0' + currentDateTime.getUTCMinutes()).slice(-2);
                var seconds = ('0' + currentDateTime.getUTCSeconds()).slice(-2);

                var year2 = finalDateTime.getUTCFullYear();
                var month2 = ('0' + (finalDateTime.getUTCMonth() + 1)).slice(-2);
                var day2 = ('0' + finalDateTime.getUTCDate()).slice(-2);
                var hours2 = ('0' + finalDateTime.getUTCHours()).slice(-2);
                var minutes2 = ('0' + finalDateTime.getUTCMinutes()).slice(-2);
                var seconds2 = ('0' + finalDateTime.getUTCSeconds()).slice(-2);

                // Construir la fecha y hora en el formato deseado
                var formattedStartDate = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds + 'Z';
                var formattedEndDate = year2 + '-' + month2 + '-' + day2 + ' ' + hours2 + ':' + minutes2 + ':' + seconds2 + 'Z';

                var objDates = {
                    dateStart: formattedStartDate,
                    dateEnd: formattedEndDate
                }

                log.debug('Fecha y hora actual:', objDates);
                return objDates;
            } catch (error) {
                log.error({ title: 'error formatDate: ', details: error });
            }
        }

        /**
         * @summary Function that obtain the plants configured in their instance, need to have the arkik code
         * @returns arrUbicaciones (The array of the plants in the instance)
         */
        const obtainPlants = () => {
            try {
                var locationSearchObj = search.create({
                    type: "location",
                    filters:
                        [
                            ["custrecord_tkiio_code_locat_arkik", "isnotempty", ""]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "name",
                                sort: search.Sort.ASC,
                                label: "Name"
                            }),
                            search.createColumn({ name: "custrecord_tkiio_code_locat_arkik", label: "Código Ubicación Arkik" })
                        ]
                });
                var searchResultCount = locationSearchObj.runPaged().count;
                log.debug("locationSearchObj result count", searchResultCount);
                var arrUbicaciones = []
                locationSearchObj.run().each(function (result) {
                    var objLocations = {
                        "value": result.getValue({ name: 'custrecord_tkiio_code_locat_arkik' })
                    }
                    arrUbicaciones.push(objLocations);
                    return true;
                });
                log.debug({ title: 'arrUbicaciones', details: arrUbicaciones });
                return arrUbicaciones;
            } catch (error) {
                log.error({ title: 'error obtainPlants', details: error });
                return [];
            }
        }

        return { getInputData, map, reduce, summarize }

    });
