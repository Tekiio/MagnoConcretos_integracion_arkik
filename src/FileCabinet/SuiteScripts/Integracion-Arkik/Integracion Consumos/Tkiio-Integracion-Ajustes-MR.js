/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/https', 'N/log', 'N/search', 'N/format', 'N/runtime', 'N/record', './moment'],
    /**
 * @param{https} https
 * @param{log} log
 * @param{search} search
 */
    (https, log, search, format, runtime, record, moment) => {
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
                var startDate = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_start_date' });
                var finalDate = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_final_date' });

                var formattedStartDate = '';
                var formattedEndDate = '';
                //Only if the parameters script exists
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

                var jsonRequest = {
                    "dataArea": {
                        "get": {
                            "uniqueIndicator": false,
                            "recordSetSaveIndicator": false
                        },
                        "moveInventory": [
                            {
                                "moveInventoryLine": [
                                    {
                                        "itemInstance": [
                                            {
                                                "classification": [
                                                    {
                                                        "codes": [
                                                            {
                                                                "value": "RAW"
                                                            },
                                                            {
                                                                "value": "EXT"
                                                            }
                                                        ]
                                                    }
                                                ],
                                                "serviceIndicator": false
                                            }
                                        ],
                                        "facility": [
                                            {
                                                "id": plants
                                            }
                                        ],
                                        "reasonCode": [//dicho reasonCode indica que tipo de datos obtendra, si ajustes de inventario o pedidos, etc.
                                            {
                                                "value": "2"
                                            },
                                            {
                                                "value": "3"
                                            },
                                            {
                                                "value": "4"
                                            },
                                            {
                                                "value": "5"
                                            },
                                            {
                                                "value": "6"
                                            }

                                        ],
                                        "transactionDateTime": {
                                            "value": formattedStartDate
                                        }
                                    },
                                    {
                                        "transactionDateTime": {
                                            "value": formattedEndDate
                                        }
                                    }
                                ]
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
                            "value": "8deda36b-1371-4d53-b550-a9d519ed13d1"
                        }
                    },
                    "systemEnvironmentCode": "Production",
                    "languageCode": "en-US"
                }

                //Obtain all the parameters of conection with Arkik
                var url = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_url_consumes' });
                var autorizacion = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_code_aut_consumes' });
                var apiKey = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_api_key_consumes' });

                // // CConfigure the necesary headers
                var headers = {
                    Authorization: autorizacion,
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/json',
                };

                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(jsonRequest)
                });

                var responseBody = JSON.parse(response.body);
                var responseCode = response.code;
                var data = '';

                //if the request is succefully, enter here
                if (responseCode == 200) {
                    data = responseBody.dataArea.moveInventory;
                    log.audit({ title: 'data', details: data });
                    let reason = {}
                    log.audit({ title: 'No. transacciones recibidas:', details: data.length });
                    data.forEach((line) => {
                        log.audit({ title: 'line', details: line });
                        if (reason[line.moveInventoryLine[0].reasonCode[0].value]) {
                            reason[line.moveInventoryLine[0].reasonCode[0].value] = 0;
                        }
                        reason[line.moveInventoryLine[0].reasonCode[0].value]++;
                    })
                    log.audit({ title: 'reason', details: reason });
                    return data;
                }
                return []
            } catch (error) {
                log.error({ title: 'error getInputData', details: error });
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
                log.audit({ title: 'mapContext.value', details: mapContext.value });
                log.audit({ title: 'typeof mapContext.value', details: typeof mapContext.value });
                let value = JSON.parse(mapContext.value);
                log.audit({ title: 'value', details: value });
                log.audit({ title: 'typeof value', details: typeof value });
                // let value =
                // {
                //     moveInventoryHeader: {
                //         extension: null,
                //         lastModificationDateTime: null,
                //         documentDateTime: {
                //             typeCode: null,
                //             value: "2023-01-10 00:00:00Z"
                //         },
                //         "description": [],
                //         "note": [],
                //         documentReference: [
                //             {
                //                 "extension": [],
                //                 documentDateTime: null,
                //                 "description": [],
                //                 "note": [],
                //                 "status": [],
                //                 lineNumberID: null,
                //                 "lineIDSet": [],
                //                 typeCode: null,
                //                 actionCode: null,
                //                 id: null,
                //                 revisionID: null,
                //                 variationID: null,
                //                 documentIDSet: [
                //                     {
                //                         id: [
                //                             {
                //                                 typeCode: null,
                //                                 schemeID: null,
                //                                 schemeVersionID: null,
                //                                 schemeAgencyID: null,
                //                                 value: "--EMPTY--"
                //                             }
                //                         ],
                //                         schemeID: null,
                //                         schemeVersionID: null,
                //                         schemeAgencyID: null,
                //                         typeCode: null
                //                     }
                //                 ]
                //             }
                //         ],
                //         "attachment": [],
                //         id: {
                //             typeCode: null,
                //             schemeID: null,
                //             schemeVersionID: null,
                //             schemeAgencyID: null,
                //             value: "1929"
                //         },
                //         revisionID: null,
                //         variationID: null,
                //         "documentIDSet": []
                //     },
                //     moveInventoryLine: [
                //         {
                //             extension: [
                //                 {
                //                     anyExtension: null,
                //                     "amount": [],
                //                     "code": [],
                //                     "dateTime": [],
                //                     "id": [],
                //                     "indicator": [],
                //                     "measure": [],
                //                     "name": [],
                //                     "number": [],
                //                     quantity: [
                //                         {
                //                             typeCode: "Moisture",
                //                             unitCode: "%",
                //                             value: 0
                //                         }
                //                     ],
                //                     "text": [],
                //                     "time": [],
                //                     "valueText": [],
                //                     typeCode: null,
                //                     actionCode: null,
                //                     sequenceNumber: null
                //                 }
                //             ],
                //             "itemInstance": [],
                //             quantity: [
                //                 {
                //                     typeCode: "Entry",
                //                     unitCode: "TO",
                //                     value: 35
                //                 },
                //                 {
                //                     typeCode: "Inventory",
                //                     unitCode: "TO",
                //                     value: 35
                //                 }
                //             ],
                //             glEntityID: null,
                //             facility: [
                //                 {
                //                     "extension": [],
                //                     cageid: null,
                //                     "name": [],
                //                     "description": [],
                //                     "note": [],
                //                     address: null,
                //                     "coordinate": [],
                //                     location: null,
                //                     "storageLocation": [],
                //                     id: [
                //                         {
                //                             typeCode: null,
                //                             schemeID: null,
                //                             schemeVersionID: null,
                //                             schemeAgencyID: null,
                //                             value: "P001"
                //                         }
                //                     ],
                //                     "idSet": [],
                //                     typeCode: null,
                //                     actionCode: null
                //                 }
                //             ],
                //             status: null,
                //             reasonCode: [
                //                 {
                //                     typeCode: null,
                //                     listID: null,
                //                     listAgencyID: null,
                //                     listVersionID: null,
                //                     value: "5"
                //                 }
                //             ],
                //             transactionDateTime: {
                //                 typeCode: null,
                //                 value: "2023-01-10 16:11:26Z"
                //             },
                //             party: [
                //                 {
                //                     "extension": [],
                //                     "accountID": [],
                //                     "name": [],
                //                     "location": [],
                //                     "contact": [],
                //                     id: [
                //                         {
                //                             typeCode: "Carrier",
                //                             schemeID: null,
                //                             schemeVersionID: null,
                //                             schemeAgencyID: null,
                //                             value: "--EMPTY--"
                //                         },
                //                         {
                //                             typeCode: "Driver",
                //                             schemeID: null,
                //                             schemeVersionID: null,
                //                             schemeAgencyID: null,
                //                             value: "--EMPTY--"
                //                         }
                //                     ],
                //                     "partyIDSet": [],
                //                     "taxIDSet": [],
                //                     "taxID": [],
                //                     dunsid: null,
                //                     cageid: null,
                //                     dodaacid: null,
                //                     bicid: null,
                //                     scacid: null,
                //                     ccrid: null,
                //                     typeCode: null,
                //                     role: null,
                //                     actionCode: null
                //                 }
                //             ],
                //             "inventoryDestination": [],
                //             description: [
                //                 {
                //                     typeCode: "short",
                //                     languageCode: null,
                //                     value: "GRAVA 20"
                //                 },
                //                 {
                //                     typeCode: "long",
                //                     languageCode: null,
                //                     value: "--EMPTY--"
                //                 }
                //             ],
                //             note: [
                //                 {
                //                     typeCode: null,
                //                     author: null,
                //                     entryDateTime: null,
                //                     status: null,
                //                     languageCode: null,
                //                     value: "--EMPTY--"
                //                 }
                //             ],
                //             "documentReference": [],
                //             "attachment": [],
                //             lineNumberID: null,
                //             lineIDSet: [
                //                 {
                //                     id: [
                //                         {
                //                             typeCode: null,
                //                             schemeID: null,
                //                             schemeVersionID: null,
                //                             schemeAgencyID: null,
                //                             value: "4002"
                //                         }
                //                     ],
                //                     schemeID: null,
                //                     schemeVersionID: null,
                //                     schemeAgencyID: null,
                //                     typeCode: null
                //                 }
                //             ],
                //             typeCode: null,
                //             actionCode: null
                //         }
                //     ],
                //     typeCode: null,
                //     actionCode: null
                // };
                let date = value.moveInventoryHeader.documentDateTime.value;
                let idArkik = value.moveInventoryHeader.id.value;

                //Search if the inventory Adjusment with de id of arkik exist in Netsuite
                let resultSearch = searchTransactionsCreated(idArkik);
                let idExistentes = resultSearch[0];

                //only if the transaction id doesn't exist entry to create a new inventory Adjustment or movement
                if (!idExistentes) {
                    log.debug({ title: 'Entre no hay transacciones asociadas', details: 'Entre no hay transacciones asociadas' });
                    var conteoCodigos = {};

                    //Search the reason codes of the inventory Lines, with the objetive of agroup and verify de movement
                    (value.moveInventoryLine).forEach(element => {
                        (element.reasonCode).forEach(code => {
                            var codigo = code.value;
                            conteoCodigos[codigo] = (conteoCodigos[codigo] || 0) + 1;
                        });
                    });
                    var codigosUnicos = Object.keys(conteoCodigos);
                    log.debug({ title: 'codigosUnicos', details: codigosUnicos });

                    //Verify the type of code, to do the respective movement
                    if ((codigosUnicos.includes("2") || codigosUnicos.includes("3"))) {
                        var ajustes = createAdjust(value);
                    } else if (codigosUnicos.includes("4")) {
                        // log.debug({title: '', details: });
                        // if(value.moveInventoryHeader.documentReference[0].documentIDSet[0].id[0].value== 'P002-000004'){//PARA PRUEBAS
                        let fullfilment = createFull(value);
                        // }
                    } else if (codigosUnicos.includes("5")) {//Queda pendiente de respuesta de Arkik
                        // Seria ordenes de compra
                        log.audit({ title: 'Creando la orden de compra', details: 'LOG de rastreo para generar la orden de compra' });
                        var purchaseOrder = createPurchaseOrder(value)
                        if (purchaseOrder !== null) {
                            var itemReceipt = createItemReceipt(purchaseOrder, value);
                        }
                    } else if (codigosUnicos.includes("6")) {//Queda pendiente de respuesta de Arkik

                        var vendorCredit = createVendorCredit(value);
                    }
                } else {
                    // si existe al menos una transaccion realizara lo siguiente
                    let noResults = resultSearch[2];
                    let resultsSS = resultSearch[1];
                    log.debug({ title: (noResults === 1 ? 'Existe una transacción con su respectivo ID' : ('Existe ' + noResults + ' transacciones con su respectivo ID')), details: 'ID ARKIK: ' + idArkik });

                    // Verifica mediante los reasonCode de que tipo de transaccion se refiere
                    var conteoCodigos = {};
                    (value.moveInventoryLine).forEach(element => {
                        (element.reasonCode).forEach(code => {
                            var codigo = code.value;
                            conteoCodigos[codigo] = (conteoCodigos[codigo] || 0) + 1;
                        });
                    });
                    var codigosUnicos = Object.keys(conteoCodigos);
                    log.debug({ title: 'codigosUnicos', details: codigosUnicos });

                    // Creando la orden de recepcion del articulo a partir de la orden de compra
                    if (codigosUnicos.includes("5")) {

                        let resultados = resultsSS.runPaged({ pageSize: 100 })
                        var thePageRanges = resultados.pageRanges;

                        if (noResults === 1) {
                            for (var i in thePageRanges) {
                                var searchPage = resultados.fetch({ index: thePageRanges[i].index });
                                searchPage.data.forEach(function (result) {
                                    log.audit({ title: 'Resultados para generar la recepcion del articulo: ', details: result });
                                    if (result.recordType === 'purchaseorder') {
                                        var itemReceipt = createItemReceipt(result.id, value);
                                    }
                                })
                            }
                        }
                    }

                }

            } catch (error) {
                log.error({ title: 'error map: ', details: error });
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

        const createFull = (value) => {
            try {
                //Obj para prueba
                // value = {
                //     "moveInventoryHeader": {
                //         "documentDateTime": {
                //             "value": "2023-02-28 00:00:00Z"
                //         },
                //         "documentReference": [
                //             {
                //                 "documentIDSet": [
                //                     {
                //                         "id": [
                //                             {
                //                                 "value": "P002-000004"
                //                             }
                //                         ]
                //                     }
                //                 ]
                //             }
                //         ],
                //         "id": {
                //             "value": "18"
                //         }
                //     },
                //     "moveInventoryLine": [
                //         {
                //             "extension": [
                //                 {
                //                     "quantity": [
                //                         {
                //                             "typeCode": "Moisture",
                //                             "unitCode": "%",
                //                             "value": 0.0
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "quantity": [
                //                 {
                //                     "typeCode": "Entry",
                //                     "unitCode": "L",
                //                     "value": 0.058
                //                 },
                //                 {
                //                     "typeCode": "Inventory",
                //                     "unitCode": "L",
                //                     "value": 0.058
                //                 }
                //             ],
                //             "facility": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "P002"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "reasonCode": [
                //                 {
                //                     "value": "4"
                //                 }
                //             ],
                //             "transactionDateTime": {
                //                 "value": "2023-02-28 19:48:52Z"
                //             },
                //             "party": [
                //                 {
                //                     "id": [
                //                         {
                //                             "typeCode": "Carrier",
                //                             "value": "--EMPTY--"
                //                         },
                //                         {
                //                             "typeCode": "Driver",
                //                             "value": "--EMPTY--"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "description": [
                //                 {
                //                     "typeCode": "short",
                //                     "value": "SIKAMENT 100"
                //                 },
                //                 {
                //                     "typeCode": "long",
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "note": [
                //                 {
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "lineIDSet": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "6002"
                //                         }
                //                     ]
                //                 }
                //             ]
                //         },
                //         {
                //             "extension": [
                //                 {
                //                     "quantity": [
                //                         {
                //                             "typeCode": "Moisture",
                //                             "unitCode": "%",
                //                             "value": 0.0
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "quantity": [
                //                 {
                //                     "typeCode": "Entry",
                //                     "unitCode": "KG",
                //                     "value": 9035.0
                //                 },
                //                 {
                //                     "typeCode": "Inventory",
                //                     "unitCode": "TO",
                //                     "value": 9.035
                //                 }
                //             ],
                //             "facility": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "P002"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "reasonCode": [
                //                 {
                //                     "value": "4"
                //                 }
                //             ],
                //             "transactionDateTime": {
                //                 "value": "2023-02-28 19:48:52Z"
                //             },
                //             "party": [
                //                 {
                //                     "id": [
                //                         {
                //                             "typeCode": "Carrier",
                //                             "value": "--EMPTY--"
                //                         },
                //                         {
                //                             "typeCode": "Driver",
                //                             "value": "--EMPTY--"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "description": [
                //                 {
                //                     "typeCode": "short",
                //                     "value": "ARENA 4D"
                //                 },
                //                 {
                //                     "typeCode": "long",
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "note": [
                //                 {
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "lineIDSet": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "1234"
                //                         }
                //                     ]
                //                 }
                //             ]
                //         },
                //         {
                //             "extension": [
                //                 {
                //                     "quantity": [
                //                         {
                //                             "typeCode": "Moisture",
                //                             "unitCode": "%",
                //                             "value": 0.0
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "quantity": [
                //                 {
                //                     "typeCode": "Entry",
                //                     "unitCode": "KG",
                //                     "value": 6535.0
                //                 },
                //                 {
                //                     "typeCode": "Inventory",
                //                     "unitCode": "TO",
                //                     "value": 6.535
                //                 }
                //             ],
                //             "facility": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "P002"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "reasonCode": [
                //                 {
                //                     "value": "4"
                //                 }
                //             ],
                //             "transactionDateTime": {
                //                 "value": "2023-02-28 19:48:52Z"
                //             },
                //             "party": [
                //                 {
                //                     "id": [
                //                         {
                //                             "typeCode": "Carrier",
                //                             "value": "--EMPTY--"
                //                         },
                //                         {
                //                             "typeCode": "Driver",
                //                             "value": "--EMPTY--"
                //                         }
                //                     ]
                //                 }
                //             ],
                //             "description": [
                //                 {
                //                     "typeCode": "short",
                //                     "value": "GRAVA 20"
                //                 },
                //                 {
                //                     "typeCode": "long",
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "note": [
                //                 {
                //                     "value": "--EMPTY--"
                //                 }
                //             ],
                //             "lineIDSet": [
                //                 {
                //                     "id": [
                //                         {
                //                             "value": "4002"
                //                         }
                //                     ]
                //                 }
                //             ]
                //         }
                //     ]
                // }

                log.debug({ title: 'value createFull: ', details: value });
                let dateReceive = value.moveInventoryHeader.documentDateTime.value;
                let date = moment.utc(dateReceive).format('DD/MM/YYYY');
                let id = value.moveInventoryHeader.id.value;
                let document = value.moveInventoryHeader.documentReference[0].documentIDSet[0].id[0].value;
                let idDocument = searchTransaction(document);
                let fechaFormateada = format.parse({ value: date, type: format.Type.DATE });

                let fulfill = record.transform({ fromType: record.Type.SALES_ORDER, fromId: idDocument, toType: record.Type.ITEM_FULFILLMENT, isDynamic: true, });
                fulfill.setValue({ fieldId: 'trandate', value: fechaFormateada });
                let lineCount = fulfill.getLineCount({ sublistId: 'item' });
                let obj = formatObj(value.moveInventoryLine);

                for (let i = lineCount - 1; i >= 0; i--) {
                    var iditem = fulfill.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    for (var item = 0; item < obj.length; item++) {
                        if (obj[item].lineIDSet[0].id[0].internalid == iditem) {
                            fulfill.selectLine({ sublistId: 'item', line: i });
                            log.debug({ title: 'obj[item].quantity[1].value', details: obj[item].quantity[1].value });
                            fulfill.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: obj[item].quantity[1].value });
                            fulfill.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: obj[item].facility[0].id[0].internalid });
                            fulfill.commitLine({ sublistId: 'item' });
                        } else {
                            log.debug({ title: 'No entre', details: 'No entre' });
                        }
                    }
                    log.debug({ title: 'id', details: iditem });
                }

                var fulfillmentId = fulfill.save({ enableSourcing: true, ignoreMandatoryFields: true })
                log.debug({ title: 'fulfillmentId', details: fulfillmentId });
                // record.submitFields({
                //     type: record.Type.ITEM_FULFILLMENT,
                //     id: fulfill,
                //     values: {custrecord_tkiio_pres_status: "2",custrecord_tkiio_pres_notas:"No se tienen Registros de talla, ingrese las tallas necesarias para el prorrateo"},
                //     options: {
                //         enablesourcing: true,
                //         ignoreMandatotyFields:true
                //     }
                // });
                // log.debug({title: 'fulfill', details: fulfill});
            } catch (error) {
                log.error({ title: 'Error createFull: ', details: error });
            }
        }

        /**
         * @summary Función que servirá para verificar si la transaccion ya existe o no
         * @param {*} doc 
         * @returns 
         */
        const searchTransaction = (doc) => {
            try {
                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters:
                        [
                            ["type", search.Operator.ANYOF, "SalesOrd"],
                            "AND",
                            ["custbody_tkiio_id_trans_arkik", search.Operator.IS, doc],
                            "AND",
                            ["mainline", search.Operator.IS, "T"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "tranid", label: "Document Number" })
                        ]
                });
                var searchResultCount = salesorderSearchObj.runPaged().count;
                log.debug("salesorderSearchObj result count", searchResultCount);

                let idInterno = ''
                salesorderSearchObj.run().each(function (result) {
                    idInterno = result.getValue({ name: 'internalid' })
                    return true;
                });
                return idInterno;
            } catch (error) {
                log.error({ title: 'error searchTransaction: ', details: error });
                return ''
            }
        }
        /**
         * @summary Function that create the inventory Adjust and set the Arkik id to the field 'ID movimiento Arkik'
         * @param {*} value 
         */
        function createAdjust(value) {
            try {
                log.debug({ title: 'value createAdjust', details: value });
                var account = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_adjusment_account' });
                var dateReceive = value.moveInventoryHeader.documentDateTime.value;
                var date = moment.utc(dateReceive).format('DD/MM/YYYY');
                var id = value.moveInventoryHeader.id.value;
                var fechaFormateada = format.parse({ value: date, type: format.Type.DATE });

                //Obj de prueba
                // var prueba = [//    QUITAAAAAAAAR CAMBIAR POR value.moveInventoryLine[0]
                //     {
                //         extension: [
                //             {
                //                 quantity: [
                //                     {
                //                         typeCode: "Moisture",
                //                         unitCode: "%",
                //                         value: 0
                //                     }
                //                 ]
                //             }
                //         ],
                //         quantity: [
                //             {
                //                 typeCode: "Entry",
                //                 unitCode: "TO",
                //                 value: 10000
                //             },
                //             {
                //                 typeCode: "Inventory",
                //                 unitCode: "TO",
                //                 value: 10000
                //             }
                //         ],
                //         facility: [
                //             {
                //                 id: [
                //                     {
                //                         value: "P002"
                //                     }
                //                 ]
                //             }
                //         ],
                //         reasonCode: [
                //             {
                //                 value: "2"
                //             }
                //         ],
                //         transactionDateTime: {
                //             value: "2023-02-14 19:30:31Z"
                //         },
                //         party: [
                //             {
                //                 id: [
                //                     {
                //                         typeCode: "Carrier",
                //                         value: "--EMPTY--"
                //                     },
                //                     {
                //                         typeCode: "Driver",
                //                         value: "--EMPTY--"
                //                     }
                //                 ],
                //             }
                //         ],
                //         "inventoryDestination": [],
                //         description: [
                //             {
                //                 typeCode: "short",
                //                 value: "ARENA 4D"
                //             },
                //             {
                //                 typeCode: "long",
                //                 value: "--EMPTY--"
                //             }
                //         ],
                //         note: [
                //             {
                //                 value: "--EMPTY--"
                //             }
                //         ],
                //         lineIDSet: [
                //             {
                //                 id: [
                //                     {
                //                         value: "076418512" //The SKU
                //                     }
                //                 ],
                //             }
                //         ]
                //     },
                //     {
                //         extension: [
                //             {
                //                 quantity: [
                //                     {
                //                         typeCode: "Moisture",
                //                         unitCode: "%",
                //                         value: 0
                //                     }
                //                 ]
                //             }
                //         ],
                //         quantity: [
                //             {
                //                 typeCode: "Entry",
                //                 unitCode: "TO",
                //                 value: 10000
                //             },
                //             {
                //                 typeCode: "Inventory",
                //                 unitCode: "TO",
                //                 value: 10000
                //             }
                //         ],
                //         facility: [
                //             {
                //                 id: [
                //                     {
                //                         value: "P002"
                //                     }
                //                 ]
                //             }
                //         ],
                //         reasonCode: [
                //             {
                //                 value: "2"
                //             }
                //         ],
                //         transactionDateTime: {
                //             value: "2023-02-14 19:30:31Z"
                //         },
                //         party: [
                //             {
                //                 id: [
                //                     {
                //                         typeCode: "Carrier",
                //                         value: "--EMPTY--"
                //                     },
                //                     {
                //                         typeCode: "Driver",
                //                         value: "--EMPTY--"
                //                     }
                //                 ],
                //             }
                //         ],
                //         "inventoryDestination": [],
                //         description: [
                //             {
                //                 typeCode: "short",
                //                 value: "ARENA 4D"
                //             },
                //             {
                //                 typeCode: "long",
                //                 value: "--EMPTY--"
                //             }
                //         ],
                //         note: [
                //             {
                //                 value: "--EMPTY--"
                //             }
                //         ],
                //         lineIDSet: [
                //             {
                //                 id: [
                //                     {
                //                         value: "1234" //The SKU
                //                     }
                //                 ],
                //             }
                //         ]
                //     },
                // ];

                var formatObject = formatObj(value.moveInventoryLine);//Format the original object value.moveInventoryLine[0]
                log.debug({ title: 'formatObject', details: formatObject });

                if (formatObject.length !== 0) {
                    if (account && date && id) {//Only if the account, date and transaction id exists, do the process

                        //Create the record and set the main data
                        var inventoryAdjustment = record.create({
                            type: record.Type.INVENTORY_ADJUSTMENT,
                            isDynamic: true
                        });

                        inventoryAdjustment.setValue({
                            fieldId: 'account',
                            value: account
                        });

                        inventoryAdjustment.setValue({
                            fieldId: 'trandate',
                            value: fechaFormateada
                        });

                        inventoryAdjustment.setValue({
                            fieldId: 'custbody_tkiio_mov_arkik',
                            value: id
                        });

                        //Process each item
                        formatObject.forEach(item => {
                            //Only if the internal ID exists process the item
                            if (item.lineIDSet[0].id[0].internalid) {

                                var quantityInventory = 0;
                                (item.quantity).forEach(quant => {
                                    if (quant.typeCode == "Inventory") {
                                        quantityInventory = quant.value
                                    }
                                });
                                log.debug({ title: 'quantityInventory', details: quantityInventory });
                                log.debug({ title: 'item.lineIDSet[0].id[0].internalid', details: item.lineIDSet[0].id[0].internalid });
                                inventoryAdjustment.selectNewLine({
                                    sublistId: 'inventory'
                                });

                                inventoryAdjustment.setCurrentSublistValue({
                                    sublistId: 'inventory',
                                    fieldId: 'item',
                                    value: item.lineIDSet[0].id[0].internalid
                                });

                                inventoryAdjustment.setCurrentSublistValue({
                                    sublistId: 'inventory',
                                    fieldId: 'location',
                                    value: item.facility[0].id[0].internalid
                                });

                                inventoryAdjustment.setCurrentSublistValue({
                                    sublistId: 'inventory',
                                    fieldId: 'adjustqtyby',
                                    value: quantityInventory
                                });
                                inventoryAdjustment.commitLine({
                                    sublistId: 'inventory',
                                });
                            } else {
                                log.debug({ title: 'El artículo no tiene asociado un id Interno', details: 'El artículo no tiene asociado un id Interno' });
                            }
                        });
                        var inventoryAdjustmentId = inventoryAdjustment.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                    } else {
                        log.debug({ title: 'No existe una cuenta/fecha/id correspondientes', details: 'No existe una cuenta/fecha/id correspondientes' });
                    }
                } else {
                    log.audit({ title: 'No se encontro todos articulos/ubicaciones', details: 'Ubicaciones/Articulos no cargados en Netsuite, favor de esperar a la sincronizacion.' });
                }

            } catch (error) {
                log.error({ title: 'error createAdjust', details: error });
            }
        }
        function createPurchaseOrder(value) {
            try {

                // Valores por defecto que deben tener las ordenes de compra
                var vendor = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_proveedor_aux' });
                var statusDefault = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_status_default' });
                var nextApproverDefault = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_next_approver' });
                var employeeDefault = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_employee_default' });

                log.audit({ title: 'vendor', details: vendor });
                log.audit({ title: 'value', details: value });
                log.debug({ title: 'value createAdjust', details: value });
                var account = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_adjusment_account' });
                var dateReceive = value.moveInventoryHeader.documentDateTime.value;
                var date = moment.utc(dateReceive).format('DD/MM/YYYY');
                var id = value.moveInventoryHeader.id.value;
                var fechaFormateada = format.parse({ value: date, type: format.Type.DATE });

                var formatObject = formatObj(value.moveInventoryLine);
                log.debug({ title: 'formatObject', details: formatObject });

                // Verifica si existen items o ubicaciones, esto con la finalidad de que se encuentren las lineas completas
                if (formatObject.length !== 0) {
                    // Verifica si los campos obligatorios de la transaccion se encuentran
                    if (account && date && id) {

                        //Create the record and set the main data
                        var purchaseOrder = record.create({ type: record.Type.PURCHASE_ORDER, isDynamic: true });

                        // Campos nivel cabecera
                        // purchaseOrder.setValue({ fieldId: 'account', value: account });
                        purchaseOrder.setValue({ fieldId: 'entity', value: vendor });
                        purchaseOrder.setValue({ fieldId: 'employee', value: employeeDefault });
                        purchaseOrder.setValue({ fieldId: 'approvalstatus', value: statusDefault });
                        purchaseOrder.setValue({ fieldId: 'nextapprover', value: nextApproverDefault });
                        purchaseOrder.setValue({ fieldId: 'trandate', value: fechaFormateada });
                        purchaseOrder.setValue({ fieldId: 'location', value: formatObject[0].facility[0].id[0].internalid });
                        purchaseOrder.setValue({ fieldId: 'custbody_tkiio_mov_arkik', value: id });

                        log.audit({
                            title: 'Valores Obtenidos', details:
                            {
                                aprovador: purchaseOrder.getValue({ fieldId: 'nextapprover' }),
                                status: purchaseOrder.getValue({ fieldId: 'approvalstatus' }),
                                empleado: purchaseOrder.getText({ fieldId: 'employee' })

                            }
                        });
                        // Recorrido de los articulos
                        // Campos a nivel linea
                        formatObject.forEach(item => {
                            //Only if the internal ID exists process the item
                            if (item.lineIDSet[0].id[0].internalid) {

                                var quantityInventory = 0;
                                (item.quantity).forEach(quant => {
                                    if (quant.typeCode == "Inventory") {
                                        quantityInventory = quant.value
                                    }
                                });
                                log.debug({ title: 'quantityInventory', details: quantityInventory });
                                log.debug({ title: 'item.lineIDSet[0].id[0].internalid', details: item.lineIDSet[0].id[0].internalid });

                                purchaseOrder.selectNewLine({ sublistId: 'item' });
                                purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item.lineIDSet[0].id[0].internalid });
                                purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: item.lineIDSet[0].id[0].cost });
                                purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantityInventory });
                                // purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode', value: 5 });
                                log.audit({ title: 'purchaseOrder.getValue()', details: purchaseOrder.getCurrentSublistValue({ sublistId: 'item', fieldId: 'taxcode' }) });
                                log.audit({ title: 'Item en sublist', details: purchaseOrder.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }) });
                                purchaseOrder.commitLine({ sublistId: 'item' }); // Ignorar campos obligatorios
                            } else {
                                log.debug({ title: 'El artículo no tiene asociado un id Interno', details: 'El artículo no tiene asociado un id Interno' });
                            }
                        });
                        var purchaseOrderId = purchaseOrder.save({ enableSourcing: true, ignoreMandatoryFields: true });
                        return purchaseOrderId;
                    } else {
                        log.debug({ title: 'No existe una cuenta/fecha/id correspondientes', details: 'No existe una cuenta/fecha/id correspondientes' });
                    }
                } else {
                    log.audit({ title: 'No se encontro todos articulos/ubicaciones', details: 'Ubicaciones/Articulos no cargados en Netsuite, favor de esperar a la sincronizacion.' });
                }
                return null;
            } catch (e) {
                log.error({ title: 'Error createPurchaseOrder:', details: e });
                return null;
            }
        }
        function createItemReceipt(id, value) {
            try {
                let itemReceipt = record.transform({ fromType: record.Type.PURCHASE_ORDER, fromId: id, toType: record.Type.ITEM_RECEIPT, isDynamic: true });
                let lineCount = itemReceipt.getLineCount({ sublistId: 'item' });

                var date = moment.utc(new Date()).format('DD/MM/YYYY');
                let fechaFormateada = format.parse({ value: date, type: format.Type.DATE });
                log.audit({ title: 'date', details: fechaFormateada });
                itemReceipt.setValue({ fieldId: 'trandate', value: fechaFormateada })
                let obj = formatObj(value.moveInventoryLine);

                for (let i = lineCount - 1; i >= 0; i--) {
                    var iditem = itemReceipt.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    for (var item = 0; item < obj.length; item++) {
                        if (obj[item].lineIDSet[0].id[0].internalid == iditem) {
                            itemReceipt.selectLine({ sublistId: 'item', line: i });
                            log.debug({ title: 'obj[item].quantity[1].value', details: obj[item].quantity[1].value });
                            itemReceipt.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: obj[item].quantity[1].value });
                            itemReceipt.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: obj[item].facility[0].id[0].internalid });
                            itemReceipt.commitLine({ sublistId: 'item' });
                        } else {
                            log.debug({ title: 'No entre', details: 'No entre' });
                        }
                    }
                    log.debug({ title: 'id', details: iditem });
                }

                var itemReceiptId = itemReceipt.save({ enableSourcing: true, ignoreMandatoryFields: true })
                log.debug({ title: 'ID de la recepcion del articulo:', details: itemReceiptId });
            } catch (e) {
                log.error({ title: 'Error createItemReceipt:', details: e });
            }
        }
        function createVendorCredit(value) {
            try {

                var dateReceive = value.moveInventoryHeader.documentDateTime.value;
                var date = moment.utc(dateReceive).format('DD/MM/YYYY');
                var id = value.moveInventoryHeader.id.value;
                var fechaFormateada = format.parse({ value: date, type: format.Type.DATE });
                var vendor = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_proveedor_aux' });
                var formatObject = formatObj(value.moveInventoryLine);//Format the original object value.moveInventoryLine[0]
                log.debug({ title: 'formatObject', details: formatObject });

                if (formatObject.length !== 0) {
                    if (date && id) {//Only if the account, date and transaction id exists, do the process

                        //Create the record and set the main data
                        let vendorCredit = record.create({ type: record.Type.VENDOR_CREDIT, isDynamic: true });

                        vendorCredit.setValue({ fieldId: 'trandate', value: fechaFormateada });
                        vendorCredit.setValue({ fieldId: 'entity', value: vendor });
                        vendorCredit.setValue({ fieldId: 'custbody_tkiio_mov_arkik', value: id });

                        //Process each item
                        formatObject.forEach(item => {
                            //Only if the internal ID exists process the item
                            if (item.lineIDSet[0].id[0].internalid) {

                                var quantityInventory = 0;
                                (item.quantity).forEach(quant => {
                                    if (quant.typeCode == "Inventory") {
                                        quantityInventory = quant.value
                                    }
                                });
                                log.debug({ title: 'quantityInventory', details: quantityInventory });
                                log.debug({ title: 'item.lineIDSet[0].id[0].internalid', details: item.lineIDSet[0].id[0].internalid });

                                vendorCredit.selectNewLine({ sublistId: 'item' });
                                vendorCredit.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item.lineIDSet[0].id[0].internalid });
                                vendorCredit.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantityInventory });
                                vendorCredit.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: item.facility[0].id[0].internalid });
                                vendorCredit.commitLine({ sublistId: 'item', });
                            } else {
                                log.debug({ title: 'El artículo no tiene asociado un id Interno', details: 'El artículo no tiene asociado un id Interno' });
                            }
                        });
                        let vendorCreditId = vendorCredit.save({ enableSourcing: true, ignoreMandatoryFields: true })
                    } else {
                        log.debug({ title: 'No existe una cuenta/fecha/id correspondientes', details: 'No existe una cuenta/fecha/id correspondientes' });
                    }
                } else {
                    log.audit({ title: 'No se encontro todos articulos/ubicaciones', details: 'Ubicaciones/Articulos no cargados en Netsuite, favor de esperar a la sincronizacion.' });
                }
            } catch (e) {
                log.error({ title: 'Error createVendorCredit:', details: e });
            }
        }
        /**
         * @summary Function that generate the object with the necesary internals id (For items and for plants)
         * @param {*} obj 
         * @returns [obj] Object that contains the internals id
         */
        function formatObj(obj) {//CHANGE THE FIELD PRUEBA FOR OTHER
            try {
                var arrSKUItems = [];//arrSKUItems it's an array, that contains the sku of every item
                var arrCodesLoc = {};// it's an object that contains the codes Arkik of the location
                (obj).forEach(element => {//CHANGE PRUEBA FOR value.moveInventoryLine
                    arrSKUItems.push(element.lineIDSet[0].id[0].value);
                    var valor = element.facility[0].id[0].value;
                    arrCodesLoc[valor] = true;
                });
                var idItems = obtainIDItems(arrSKUItems);//Search the item with the sku and obtain their internal id in netsuite
                var arrCodigosLoc = Object.keys(arrCodesLoc);//Obtain the array with their code arkik
                var idLocation = obtainIdLoc(arrCodigosLoc);//Search the item with the internal id in netsuite

                log.audit({ title: 'idItems', details: idItems });
                //Verify for every item/location if have an internalId associated, otherwise put the internalid empty
                obj.forEach(element => {//CHANGE PRUEBA FOR VALUE.MOVEINVENTORYLINE
                    var internal = '';
                    var cost = '';
                    var internalLoc = '';

                    idItems.find(id => {
                        if (id.upcode === element.lineIDSet[0].id[0].value) {
                            internal = id.idInterno;
                            cost = id.cost;
                        }
                        return internal;
                    });

                    idLocation.find(id => { // find the location in the object
                        if (id.codArkik === element.facility[0].id[0].value) {
                            internalLoc = id.internalid;
                        }
                        return internalLoc;
                    });

                    if (internal) {//Verify if the internal of the item exists and set the value
                        element.lineIDSet[0].id[0].internalid = internal;
                        element.lineIDSet[0].id[0].cost = cost;
                    } else {
                        element.lineIDSet[0].id[0].internalid = '';
                    }

                    if (internalLoc) {//Verify if the internal of the location exist and set the value
                        element.facility[0].id[0].internalid = internalLoc;
                    } else {
                        element.facility[0].id[0].internalid = '';
                    }
                });
                // Verifica si la cantidad de articulos obtenidos del Response coinciden con los que estan en Netsuite
                // Verifica si la cantidad de ubicaciones obtenidas del Response coinciden con las que estan en Netsuite
                return ((obj.length === arrSKUItems.length && arrCodigosLoc.length === idLocation.length) ? obj : []);
            } catch (error) {
                log.error({ title: 'errorformatObj', details: error });
                return [];
            }
        }

        /**
         * @summary Function that search the internal id of the plants
         * @param {*} arrCodigosLoc 
         */
        function obtainIdLoc(arrCodigosLoc) {
            try {
                //Generate a variable Filters with the desired structure
                var filtros = arrCodigosLoc.map(function (idArkik, index) {
                    return ["custrecord_tkiio_code_locat_arkik", "is", idArkik]
                });

                /*Verify if the length filter is greater than 0
                  if yes, create the structure of the filters with the conditions 
                */
                if (filtros.length > 1) {
                    filtros = filtros.reduce(function (acc, filter, index) {
                        if (index !== filtros.length - 1) {
                            acc.push(filter, "OR");
                        } else {
                            acc.push(filter);
                        }
                        return acc;
                    }, [])
                }
                log.debug({ title: 'filters', details: filtros });
                var locationSearchObj = search.create({
                    type: "location",
                    filters: filtros,
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "custrecord_tkiio_code_locat_arkik", label: "Código Ubicación Arkik" })
                        ]
                });

                var arrLocations = [];
                locationSearchObj.run().each(function (result) {
                    var objLocations = {
                        internalid: result.getValue({ name: 'internalid' }),
                        codArkik: result.getValue({ name: 'custrecord_tkiio_code_locat_arkik' })
                    }
                    arrLocations.push(objLocations);
                    return true;
                });
                log.debug({ title: 'arrLocations', details: arrLocations });
                return arrLocations;
            } catch (error) {
                log.error({ title: 'error obtainIdLoc', details: error });
                return [];
            }
        }
        /**
         * Function that obtain the IDs of the items with their upc code
         * @param {*} arrSKUItems 
         */
        function obtainIDItems(arrSKUItems) {
            try {
                //Generate a variable Filters with the desired structure
                var filtros = arrSKUItems.map(function (upcode, index) {
                    return ["upccode", "is", upcode]
                });

                /*Verify if the length filter is greater than 0
                  if yes, create the structure of the filters with the conditions 
                */
                if (filtros.length > 1) {
                    filtros = filtros.reduce(function (acc, filter, index) {
                        if (index !== filtros.length - 1) {
                            acc.push(filter, "OR");
                        } else {
                            acc.push(filter);
                        }
                        return acc;
                    }, [])
                }
                log.debug({ title: 'filters', details: filtros });

                var itemSearchObj = search.create({
                    type: "item",
                    filters: filtros,
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "upccode", label: "UPC Code" }),
                            search.createColumn({ name: "cost", label: "Cost" })
                        ]
                });

                var arrItems = []
                itemSearchObj.run().each(function (result) {
                    var objItems = {
                        idInterno: result.getValue({ name: "internalid" }),
                        upcode: result.getValue({ name: "upccode" }),
                        cost: result.getValue({ name: "cost" })
                    }
                    arrItems.push(objItems);
                    return true;
                });
                log.debug({ title: 'arrItems', details: arrItems });
                return arrItems;
            } catch (error) {
                log.error({ title: 'error obtainIDItems: ', details: error });
                return [];
            }
        }
        /**
         * @summary Función que buscará algun ajuste de inventario sincronizado,
         * en dado caso de que exista el ajuste de inventario con su respectivo id de Arkik
         * no lo tomará en cuenta y seguirá con el siguiente movimiento.
         * 
         */
        function searchTransactionsCreated(idArkik) {
            try {
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters:
                        [
                            ["type", "anyof", , "CustCred", "InvAdjst", "PurchOrd", "ItemShip", "ItemRcpt"],
                            "AND",
                            ["mainline", "is", "T"],
                            "AND",
                            ["custbody_tkiio_mov_arkik", "is", idArkik]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "entity", label: "Name" }),
                            search.createColumn({ name: "custbody_tkiio_mov_arkik", label: "ID Movimiento Arkik" })
                        ]
                });
                var searchResultCount = transactionSearchObj.runPaged().count;
                log.debug("transactionSearchObj result count", searchResultCount);
                var flag = false;
                if (searchResultCount != 0) {
                    flag = true;
                }
                // inventoryadjustmentSearchObj.run().each(function (result) {
                //     // .run().each has a limit of 4,000 results
                //     return true;
                // });
                return [flag, transactionSearchObj, searchResultCount];
            } catch (error) {
                log.error({ title: 'error search', details: error });
            }
        }
        /**
         * @summary Function that obtain the plants configured in their instance
         * @returns arrUbicaciones (The array of the plants in the instance)
         */
        function obtainPlants() {
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

        /**
         * @summary Function that format the date to the desired format
         * @returns 
         */
        function formatDate() {
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
                // Imprimir la fecha y hora actual en el formato deseado
                log.debug('Fecha y hora actual:', objDates);
                return objDates;
            } catch (error) {
                log.error({ title: 'error formatDate: ', details: error });
            }
        }

        return { getInputData, map, reduce, summarize }

    });
