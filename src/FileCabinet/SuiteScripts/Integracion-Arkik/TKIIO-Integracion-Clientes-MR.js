/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/**
* @name TKIIO-Integracion-Clientes-MR
* @version 1.0
* @author Adrián Aguilar <adrian.aguilar@freebug.mx>
* @summary Script que sincronizará los clientes con Arkik. Importante considerar los campos del Script
* @copyright Tekiio México 2022
* 
* Client              -> Magno Concretos
* Last modification   -> Fecha
* Modified by         -> Adrián Aguilar <adrian.aguilar@freebug.mx>
* Script in NS        -> Registro en Netsuite <ID del registro>
*/
define(['N/https', 'N/log', 'N/record', 'N/search', 'N/runtime'],
    /**
   * @param{https} https
   * @param{log} log
   * @param{record} record
   */
    (https, log, record, search, runtime) => {
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
                var clientes = searchClients();
                log.debug({ title: 'clientes', details: clientes });

                return clientes;
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
                log.debug({ title: "map context", details: mapContext });
                var sync = {
                    "actionCriteria": [
                        {
                            "actionExpression": [
                                {
                                    "value": "Syncronize"
                                }
                            ],
                            "changeStatus": {
                                "effectiveTimePeriod": {
                                    "inclusiveIndicator": {
                                        "value": false
                                    }
                                }
                            }
                        }
                    ],
                    "recordSetCompleteIndicator": false
                }
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
                        "value": "89de1e35-c341-40c3-a57a-e3213e87e415"
                    }
                }
                var clientes = [JSON.parse(mapContext.value)]

                //Armado del JSON segun como lo requiere ARKIK.
                var json = {
                    dataArea: {
                        sync: sync,
                        partyMaster: clientes,
                    },
                    applicationArea: applicaArea,
                    "versionID": "v10.6",
                    "systemEnvironmentCode": "Test",
                    "languageCode": "en-US"
                }
                var idClient = "";

                (json.dataArea.partyMaster).forEach(client => {
                    idClient = client.idInterno;
                    delete client.idInterno;

                    (client.location).forEach(loc => {
                        delete loc.idInterno;
                    });

                    (client.contact).forEach(contact => {
                        delete contact.idInterno;
                    });

                });

                // delete json.partyMaster.idInterno //Se elimina el idInterno ya que no entra en la estructura json de arkik
                log.debug({ title: 'json Nuevo', details: json });

                //Credenciales para consumir la api
                var url = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_url' });
                var autorizacion = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_authorization' });
                var apiKey = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_api_key' });

                // // Configurar los encabezados de la solicitud HTTPS
                var headers = {
                    Authorization: autorizacion,
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/json'
                };


                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(json)
                });

                var responseBody = response.body;
                var responseCode = response.code;

                if (responseCode === 200) {
                    log.debug('API Response', responseBody);
                    // log.debug({title: 'response.body', details:typeof response.body});
                    var objResponse = JSON.parse(responseBody);
                    log.debug({ title: 'objResponse', details: objResponse });
                    (objResponse.dataArea.bod).forEach(element => {
                        log.debug({ title: 'entre al forEach', details: 'entre al forEach' });
                        log.debug({ title: 'element.bodFailureMessage', details: typeof element.bodFailureMessage });
                        log.debug({ title: 'element.bodSuccessMessage', details: typeof element.bodSuccessMessage });
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
                                type: record.Type.CUSTOMER,
                                id: idClient,
                                values: {
                                    'custentity_tkiio_arkik_integration': false,
                                    'custentity_tkiio_arkik_status_client': 'Error al actualizar proyecto ' + msj
                                }
                            });
                        } else if (element.bodSuccessMessage) {
                            log.debug({ title: 'Se actualizo correctamente', details: "Se actualizo correctamente" });
                            record.submitFields({
                                type: record.Type.CUSTOMER,
                                id: idClient,
                                values: {
                                    'custentity_tkiio_arkik_integration': true,
                                    'custentity_tkiio_arkik_status_client': "El cliente fue actualizado correctamente en Arkik. "
                                }
                            });
                        }
                    });
                } else {
                    log.error('API Error', 'Response code: ' + responseCode + ', Response body: ' + responseBody);

                    let objErrors = JSON.parse(responseBody).errors;
                    log.audit({ title: 'objErrors', details: objErrors });
                    let msg = '';
                    for (let key in objErrors) {
                        log.audit({ title: 'key', details: key });
                        if (key.indexOf('latitudeMeasure') !== -1) {
                            msg = 'Debe llenar el campo de latitud'
                        }
                        if (key.indexOf('longitudeMeasure') !== -1) {
                            msg = 'Debe llenar el campo de longitud'
                        }
                    }

                    log.audit({ title: 'msg', details: msg });

                    record.submitFields({
                        type: record.Type.CUSTOMER,
                        id: idClient,
                        values: {
                            'custentity_tkiio_arkik_integration': false,
                            'custentity_tkiio_arkik_status_client': (!msg) ? "Ocurrio un error inesperado, consulte a su Administrador." : msg
                        }
                    });
                }

            } catch (error) {
                log.error({ title: 'error', details: error });
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

        }

        /**
         * @summary Function that search the customers that have the check Integracción Arkik in False
         * @returns Returns the object of partyMaster
         */
        function searchClients() {
            try {
                var customerSearchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            //["internalid", "anyof", "3117"],
                            //"AND",
                            ["stage", "noneof", "PROSPECT", "LEAD"],
                            "AND",
                            ["custentity_tkiio_arkik_integration", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "id interno" }),
                            search.createColumn({ name: "custentity_efx_fe_metodopago", label: "EFX FE - Método de Pago" }),
                            search.createColumn({ name: "custentity_tkiio_arkik_rol", label: "Arkik Rol" }),
                            search.createColumn({ name: "entityid", sort: search.Sort.ASC, label: "ID" }),
                            search.createColumn({ name: "companyname", label: "Nombre de la empresa" }),
                            search.createColumn({ name: "custrecord_streetnum", join: "billingAddress", label: "Street Number" }),
                            search.createColumn({ name: "custrecord_streetname", join: "billingAddress", label: "Street Name" }),
                            search.createColumn({ name: "city", join: "billingAddress", label: "Ciudad" }),
                            search.createColumn({ name: "custrecord_efx_fe_colony", join: "billingAddress", label: "Colonia" }),
                            search.createColumn({ name: "countrycode", join: "billingAddress", label: "Código de país" }),
                            search.createColumn({ name: "zipcode", join: "billingAddress", label: "Código postal" }),
                            search.createColumn({ name: "custrecord_floor", join: "billingAddress", label: "FL" }),
                            search.createColumn({ name: "custrecord_unit", join: "billingAddress", label: "Unit Number" }),
                            search.createColumn({ name: "custentity_tkiio_latitud", label: "Latitud" }),
                            search.createColumn({ name: "custentity_tkiio_longitud", label: "Longitud" }),
                            search.createColumn({ name: "custentity_tkiio_payment_method_arkik", label: "Metodo Arkik" })
                        ]
                });
                var searchResultCount = customerSearchObj.runPaged().count;
                log.debug("customerSearchObj result count", searchResultCount);

                var myPagedResults = customerSearchObj.runPaged({
                    pageSize: 1000
                });
                var thePageRanges = myPagedResults.pageRanges;

                let clientes = []
                var clientsID = []; //This object
                for (var i in thePageRanges) {
                    var thepageData = myPagedResults.fetch({ index: thePageRanges[i].index });
                    thepageData.data.forEach(function (result) {

                        var rol = codigos(result.getText({ name: "custentity_tkiio_arkik_rol" }));
                        clientsID.push(result.getText({ name: "internalid" }));

                        //Create the object of Clients (This object is required to the API's Arkik)
                        var objClientes = {
                            "idInterno": result.getText({ name: "internalid" }),
                            "paymentMethodCode": {
                                "value": (result.getText({ name: "custentity_tkiio_payment_method_arkik" })).substring(0, 2) || "",
                            },
                            "partnerRoleCodes": [{
                                "typeCode": (result.getText({ name: "custentity_tkiio_arkik_rol" })).substring(0, 2) || "",
                                "value": (result.getValue({ name: "entityid" })) || "",
                            }],
                            "accountID": [{
                                "value": (result.getValue({ name: "entityid" })) || ""
                            }],
                            "name": [{
                                "value": result.getValue({ name: "companyname" }) || ""
                            }],
                            "location": [

                            ],
                            "contact": [ //This object will be filled with the contacts that the client will have associated

                            ]
                        }

                        clientes.push(objClientes);
                        return true;
                    });
                }

                var direcciones = obtainAddress(clientsID);//Obtencion de todas las ubicaciones por cliente
                var contacts = obtainContacts(clientsID);//Obtencion de todos los contactos por cliente
                log.debug({ title: 'contacts', details: contacts });

                var direccionesAgrupadas = direcciones.reduce(function (acc, direccion) { // Agrupo las direcciones con su idInterno
                    if (!acc[direccion.idInterno]) {
                        acc[direccion.idInterno] = []
                    }
                    acc[direccion.idInterno].push(direccion);
                    return acc;
                }, {});
                log.debug({ title: 'direecionesAgrupadas', details: direccionesAgrupadas });

                var contactosAgrupados = contacts.reduce(function (acc, contacto) {//Agrupa los contactos con su idInterno
                    if (!acc[contacto.idInterno]) {
                        acc[contacto.idInterno] = [];
                    }
                    acc[contacto.idInterno].push(contacto);

                    return acc;
                }, {});
                log.debug({ title: 'contactosAgrupados', details: contactosAgrupados });

                // Llenar la lista de contacts en cada cliente según el idInterno
                clientes.forEach(function (cliente) {
                    var idInterno = cliente.idInterno;

                    if (contactosAgrupados[idInterno]) {
                        cliente.contact = contactosAgrupados[idInterno];
                    }
                    if (direccionesAgrupadas[idInterno]) {
                        cliente.location = direccionesAgrupadas[idInterno];
                    }
                });

                log.debug({ title: 'clientes Busqueda', details: clientes });
                return clientes;
            } catch (error) {
                log.error({ title: 'searchClients', details: error });
            }
        }

        /**
         * @summary Función que servirá para obtener los códigos tal cual lo necesita arkik
         * @param {*} campo 
         */
        function codigos(campo) {
            try {
                log.debug({ title: 'campo', details: campo });
                const primerParentesis = campo.indexOf("(");
                const segundoParentesis = campo.indexOf(")");

                if (primerParentesis !== -1 && segundoParentesis !== -1 && segundoParentesis > primerParentesis) {
                    var campoValue = campo.substring(primerParentesis + 1, segundoParentesis);
                }

                return campoValue;
            } catch (error) {
                log.error({ title: 'error Codigos', details: error });
            }
        }

        /**
         * @summary Function that obtain all the address of the client
         */
        function obtainAddress(clientsID) {
            try {
                // log.debug({title: 'clientdID', details: clientdID});
                var customerSearchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            ["internalid", "anyof", clientsID]
                            // ["company", "anyof", clientsID]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "custrecord_streetnum", join: "Address", label: "Número de Calle (Número Exterior)" }),
                            search.createColumn({
                                name: "formulatext",
                                formula: "CASE WHEN {toplevelparent.internalid} = {internalid} THEN 1 ELSE 0 END",
                                label: "Formula (Text)"
                            }),
                            search.createColumn({ name: "custrecord_streetname", join: "Address", label: "Calle" }),
                            search.createColumn({ name: "city", join: "Address", label: "Ciudad" }),
                            search.createColumn({ name: "custrecord_efx_fe_colony", join: "Address", label: "Colonia" }),
                            search.createColumn({ name: "countrycode", join: "Address", label: "Código de país" }),
                            search.createColumn({ name: "zipcode", join: "Address", label: "Código postal" }),
                            search.createColumn({ name: "custrecord_floor", join: "Address", label: "Piso" }),
                            search.createColumn({ name: "custrecord_unit", join: "Address", label: "Apartamento (Número Interior)" }),
                            search.createColumn({ name: "custentity_tkiio_longitud", label: "Longitud" }),
                            search.createColumn({ name: "custentity_tkiio_latitud", label: "Latitud" }),
                            search.createColumn({ name: "internalid", label: "ID interno" }),
                            // Se obtienen las latitudes del cliente
                            search.createColumn({ name: "custrecord_tkiio_latitud_address", join: "Address", label: "Latitud" }),
                            search.createColumn({ name: "custrecord_tkiio_longitud_address", join: "Address", label: "Longitud" })
                        ]
                });
                var searchResultCount = customerSearchObj.runPaged().count;
                log.debug("customerSearchObj result count", searchResultCount);

                var direcciones = []
                customerSearchObj.run().each(function (result) {
                    let tipoEntidad = parseInt(result.getValue({ name: "formulatext", formula: "CASE WHEN {toplevelparent.internalid} = {internalid} THEN 1 ELSE 0 END" }))
                    var objUbicacion = {
                        "idInterno": result.getValue({ name: "internalid" }),
                        "address": [
                            {
                                "buildingNumber": {
                                    "value": result.getValue({ name: "custrecord_streetnum", join: "Address" }) || ""
                                },
                                "streetName": {
                                    "value": result.getValue({ name: "custrecord_streetname", join: "Address" }) || ""
                                },
                                "floor": {
                                    "value": result.getValue({ name: "custrecord_floor", join: "Address" }) || ""
                                },
                                "unit": {
                                    "value": ""
                                },
                                "door": {
                                    "value": result.getValue({ name: "custrecord_unit", join: "Address" }) || ""
                                },
                                "cityName": {
                                    "value": result.getValue({ name: "city", join: "Address" }) || ""
                                },
                                "citySubDivisionName": [{
                                    "value": result.getValue({ name: "custrecord_efx_fe_colony", join: "Address" }) || ""
                                }],
                                "countryCode": {
                                    "value": result.getValue({ name: "countrycode", join: "Address" }) || ""
                                },
                                "postalCode": {
                                    "value": result.getValue({ name: "zipcode", join: "Address" }) || ""
                                },
                                "geographicalCoordinate": [
                                    {
                                        "latitudeMeasure": {
                                            "value": (tipoEntidad === 0 ? parseFloat(result.getValue({ name: "custentity_tkiio_latitud" })) || '' : parseFloat(result.getValue({ name: "custrecord_tkiio_latitud_address", join: "Address" }) || ''))
                                        },
                                        "longitudeMeasure": {
                                            "value":  (tipoEntidad === 0 ? parseFloat(result.getValue({ name: "custentity_tkiio_longitud" })) || '' : parseFloat(result.getValue({ name: "custrecord_tkiio_longitud_address", join: "Address" }) || ''))
                                        }
                                    }
                                ]

                            }
                        ]

                    }
                    log.audit({ title: 'objUbicacion', details: objUbicacion });
                    direcciones.push(objUbicacion);
                    return true;
                });
                log.debug({ title: 'direcciones', details: direcciones });
                return direcciones;

            } catch (error) {
                log.error({ title: 'error obtainDirecciones', details: error });
                return []
            }
        }
        /**
         * @summary Función para obtener las ubicaciones de los clientes.
         * @param {*} clientsID 
         * @returns 
         */
        function obtainContacts(clientsID) {
            try {
                log.debug({ title: 'clientsID', details: clientsID });
                var contactSearchObj = search.create({
                    type: "contact",
                    filters:
                        [
                            ["company", "anyof", clientsID]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "ID interno" }),
                            search.createColumn({ name: "company", label: "Empresa" }),
                            search.createColumn({ name: "firstname", label: "Nombre" }),
                            search.createColumn({ name: "middlename", label: "Segundo Nombre" }),
                            search.createColumn({ name: "lastname", label: "Apellido" }),
                            search.createColumn({ name: "custentity_tkiio_country_dialing_code", label: "Código Telefónico de País " }),
                            search.createColumn({ name: "phone", label: "Teléfono" }),
                            search.createColumn({ name: "email", label: "Correo electrónico" }),
                            search.createColumn({ name: "internalid", label: "ID interno" })
                        ]
                });
                var searchResultCount = contactSearchObj.runPaged().count;
                log.debug("contactSearchObj result count", searchResultCount);
                var contacts = []
                contactSearchObj.run().each(function (result) {
                    var contactsObj = {
                        "idInterno": result.getValue({ name: "company" }),
                        "personName": [
                            {
                                "givenName": {
                                    "value": result.getValue({ name: "firstname" }) || "",
                                },
                                "familyName": [
                                    {
                                        "value": (result.getValue({ name: "middlename" }) || '') + (result.getValue({ name: "lastname" }) || '')
                                    }
                                ]
                            },
                        ],
                        "telephoneCommunication": [
                            {
                                "countryDialingCode": {
                                    "value": result.getValue({ name: "custentity_tkiio_country_dialing_code" }) || ""
                                },
                                "dialNumber": {
                                    "value": result.getValue({ name: "phone" }) || ""
                                }
                            }
                        ],
                        "eMailAddressCommunication": [
                            {
                                "eMailAddressID": {
                                    "value": result.getValue({ name: "email" }) || ""
                                }
                            }
                        ],
                        "id": [
                            {
                                "value": result.getValue({ name: "internalid" }) || ""
                            }
                        ]
                    }

                    contacts.push(contactsObj);

                    return true;
                });

                log.debug({ title: 'contacts', details: contacts });
                return contacts;
            } catch (error) {
                log.error({ title: 'error obtainClientes', details: error });
            }
        }

        return { getInputData, map, reduce, summarize }

    });
