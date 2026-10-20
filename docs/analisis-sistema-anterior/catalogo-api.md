# Catálogo de la API del sistema anterior (extraído de ApiService con REA)

## Orion2.Desktop.Services.ApiService
fields: configService: class:448; jsonOptions: class:501; ApiClient: class:665
- .ctor(class:448) → void
    calls: JsonSerializerOptions..ctor, ReferenceHandler.get_IgnoreCycles, JsonSerializerOptions.set_ReferenceHandler, JsonSerializerOptions.set_PropertyNameCaseInsensitive, JsonNamingPolicy.get_CamelCase, JsonSerializerOptions.set_PropertyNamingPolicy, JsonSerializerOptions.set_WriteIndented, JsonSerializerOptions.get_Converters, TimeSpanJsonConverter..ctor, DateTimeJsonConverter..ctor, ColorJsonConverter..ctor
- InitializeClient() → void
    strings: "application/json"
    calls: HttpClient..ctor, HttpClient.set_BaseAddress, HttpClient.get_DefaultRequestHeaders, HttpHeaders.Clear, HttpRequestHeaders.get_Accept, MediaTypeWithQualityHeaderValue..ctor, HttpHeaderValueCollection`1.Add
- AuthorizeClient() → void
    strings: "application/json", "bearer"
    calls: HttpClient.get_DefaultRequestHeaders, HttpHeaders.Clear, HttpRequestHeaders.get_Accept, MediaTypeWithQualityHeaderValue..ctor, HttpHeaderValueCollection`1.Add, AuthenticationHeaderValue..ctor, HttpRequestHeaders.set_Authorization
- LoginAsync(string, string) → class:385<class:604>
    strings: "El usuario debe ser administrador para acceder a Mercurio.", "El usuario está bloqueado. Consulte con el administrador.", "api/v1/account/login", "Usuario bloqueado.", "Usuario o contraseña no válidos", "Error interno del servidor"
    calls: HttpRequestException.get_StatusCode, HttpResponseMessage.get_IsSuccessStatusCode, HttpResponseMessage.get_Content, HttpContent.ReadAsStringAsync, HttpResponseMessage.get_StatusCode, HttpRequestException..ctor
- GetAsync(string, valuetype:209) → class:357
    strings: ": ", "\n\n"
    calls: HttpClient.GetAsync, HttpResponseMessage.get_IsSuccessStatusCode, HttpResponseMessage.get_Content, HttpContent.ReadAsStringAsync, HttpResponseMessage.get_StatusCode, HttpResponseMessage.get_ReasonPhrase
- GetAsync(string, valuetype:209) → class:385<mvar:0>
    strings: ": ", "\n\n"
    calls: HttpClient.GetAsync, HttpResponseMessage.get_IsSuccessStatusCode, HttpResponseMessage.get_Content, HttpContent.ReadAsStringAsync, HttpResponseMessage.get_StatusCode, HttpResponseMessage.get_ReasonPhrase
- PostAsync(string, mvar:0) → class:357
- PostAsync(string, mvar:0) → class:385<mvar:1>
- PutAsync(string, mvar:0) → class:357
- DeleteByIdAsync(string) → class:357
    strings: ": ", "\n\n"
    calls: HttpClient.DeleteAsync, HttpResponseMessage.get_IsSuccessStatusCode, HttpResponseMessage.get_Content, HttpContent.ReadAsStringAsync, HttpResponseMessage.get_StatusCode, HttpResponseMessage.get_ReasonPhrase
- DeleteAsync(string, mvar:0) → class:357
- GetUsuariosBasicosAsync(valuetype:209) → class:385<class:337<class:561>>
    strings: "api/v1/account/basicos"
- SendTextEmailAsync(class:361<class:561>, string, string, valuetype:209) → class:357
    strings: "api/v1/account/sendMail"
    calls: SendMailDTO..ctor, SendMailDTO.set_Asunto, SendMailDTO.set_Cuerpo, SendMailDTO.set_Direcciones
- GetConductorAsync(i4, bool, bool, valuetype:209) → class:385<class:445>
    strings: "api/v1/conductores/", "?incluirRegulaciones=", "&incluirReclamaciones="
- GetConductoresAsync(valuetype:317, bool, bool, valuetype:209) → class:385<class:337<class:445>>
    strings: "api/v1/conductores?incluirRegulaciones=", "&incluirReclamaciones=", "api/v1/conductores/porcentro?centro=", "&incluirRegulaciones="
- GetSimpleConductoresAsync(valuetype:317, valuetype:209) → class:385<class:337<class:445>>
    strings: "api/v1/conductores/simples?centro="
- AddConductorAsync(class:445) → class:385<class:445>
    strings: "api/v1/conductores"
- AddConductoresAsync(class:361<class:445>) → class:357
    strings: "api/v1/conductores/lista"
- UpdateConductorAsync(class:445) → class:357
    strings: "api/v1/conductores/"
- UpdateConductoresAsync(class:361<class:445>) → class:357
    strings: "api/v1/conductores/lista"
- DeleteConductorAsync(i4) → class:357
    strings: "api/v1/conductores/"
- DeleteConductoresAsync(class:361<class:445>) → class:357
    strings: "api/v1/conductores/lista"
- GetIdConductorAsync(i4, valuetype:209) → class:385<i4>
    strings: "api/v1/conductores/idByMatricula?matricula="
- GetRegulacionAnual(valuetype:321, i4, valuetype:209) → class:385<class:465>
    strings: "api/v1/regulaciones/regulacionAnual?fecha=", "yyyy-MM-dd", "&conductorId="
- AddRegulacionAsync(class:465) → class:385<class:465>
    strings: "api/v1/regulaciones"
- UpdateRegulacionAsync(class:465) → class:357
    strings: "api/v1/regulaciones/"
- DeleteRegulacionAsync(i4) → class:357
    strings: "api/v1/regulaciones/"
- DeleteRegulacionesAsync(class:361<class:465>) → class:357
    strings: "api/v1/regulaciones/lista"
- GetGruposAsync(valuetype:317, valuetype:209) → class:385<class:337<valuetype:321>>
    strings: "api/v1/graficos/grupos?centro="
- ExisteGrupoAsync(valuetype:317, valuetype:321, valuetype:209) → class:385<bool>
    strings: "api/v1/graficos/existeGrupo?centro=", "&fecha=", "yyyy-MM-dd"
- GetGraficoAsync(i4, bool, valuetype:209) → class:385<class:381>
    strings: "api/v1/graficos/", "?incluirItinerarios="
- GetGraficoParaFechaAsync(i4, valuetype:321, valuetype:317, bool, valuetype:209) → class:385<class:381>
    strings: "api/v1/graficos/paraFecha?numero=", "&fecha=", "yyyy-MM-dd", "&centro=", "&incluirItinerarios="
- GetGraficosAsync(valuetype:321, valuetype:317, bool, valuetype:209) → class:385<class:337<class:381>>
    strings: "api/v1/graficos/porFecha?fecha=", "yyyy-MM-dd", "&centro=", "&incluirItinerarios="
- GetGraficosEntreFechasAsync(valuetype:321, valuetype:321, valuetype:317, bool, valuetype:209) → class:385<class:337<class:381>>
    strings: "api/v1/graficos/entreFechas?desde=", "yyyy-MM-dd", "&hasta=", "&centro=", "&incluirItinerarios="
- GetDiferenciasBasicasGruposGraficos(valuetype:321, valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:577>>
    strings: "api/v1/graficos/diferencias/simples?fecha1=", "yyyy-MM-dd", "&fecha2=", "&centro="
- GetDiferenciasPdfGruposGraficos(valuetype:321, valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:581>>
    strings: "api/v1/graficos/diferencias/tablePdf?fecha1=", "yyyy-MM-dd", "&fecha2=", "&centro="
- AddGraficoAsync(class:381) → class:385<class:381>
    strings: "api/v1/graficos"
- AddGraficosAsync(class:361<class:381>) → class:357
    strings: "api/v1/graficos/lista"
- UpdateGraficoAsync(class:381) → class:357
    strings: "api/v1/graficos/"
- UpdateGraficosAsync(class:361<class:381>) → class:357
    strings: "api/v1/graficos/lista"
- DeleteGraficoAsync(i4) → class:357
    strings: "api/v1/graficos/"
- DeleteGraficosAsync(class:361<class:381>) → class:357
    strings: "api/v1/graficos/lista"
- DeleteGraficosByFechaAsync(valuetype:321, valuetype:317) → class:357
    strings: "api/v1/graficos/porFecha?fecha=", "yyyy-MM-dd", "&centro="
- GetItinerariosGraficoAsync(i4, valuetype:209) → class:385<class:337<class:505>>
    strings: "api/v1/itinerariosGraficos/byGrafico?idGrafico="
- DeleteItinerarioGraficoAsync(i4) → class:357
    strings: "api/v1/itinerariosGraficos/"
- DeleteItinerariosGraficoAsync(class:361<class:505>) → class:357
    strings: "api/v1/itinerariosGraficos/lista"
- GetConveniosAsync(valuetype:209) → class:385<class:337<class:417>>
    strings: "api/v1/convenios"
- AddConveniosAsync(class:361<class:417>) → class:357
    strings: "api/v1/convenios/lista"
- AddConvenioAsync(class:417) → class:385<class:417>
    strings: "api/v1/convenios"
- UpdateConveniosAsync(class:361<class:417>) → class:357
    strings: "api/v1/convenios/lista"
- DeleteConvenioAsync(i4) → class:357
    strings: "api/v1/convenios/"
- DeleteConveniosAsync(class:361<class:417>) → class:357
    strings: "api/v1/convenios/lista"
- GetLineasAsync(valuetype:209) → class:385<class:337<class:521>>
    strings: "api/v1/lineas"
- AddLineaAsync(class:521) → class:385<class:521>
    strings: "api/v1/lineas"
- AddLineasAsync(class:361<class:521>) → class:357
    strings: "api/v1/lineas/lista"
- UpdateLineaAsync(class:521) → class:357
    strings: "api/v1/lineas/"
- UpdateLineasAsync(class:361<class:521>) → class:357
    strings: "api/v1/lineas/lista"
- DeleteLineaAsync(i4) → class:357
    strings: "api/v1/lineas/"
- DeleteLineasAsync(class:361<class:521>) → class:357
    strings: "api/v1/lineas/lista"
- GetItinerariosAsync(valuetype:209) → class:385<class:337<class:525>>
    strings: "api/v1/itinerarios"
- GetItinerarioByNameAsync(string, valuetype:209) → class:385<class:525>
    strings: "api/v1/itinerarios/byName?name="
- DeleteItinerarioAsync(i4) → class:357
    strings: "api/v1/itinerarios/"
- DeleteItinerariosAsync(class:361<class:525>) → class:357
    strings: "api/v1/itinerarios/lista"
- DeleteParadaAsync(i4) → class:357
    strings: "api/v1/paradas/"
- DeleteParadasAsync(class:361<class:529>) → class:357
    strings: "api/v1/paradas/lista"
- GetCalendariosAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:373>>
    strings: "api/v1/calendarios/porFecha?fecha=", "yyyy-MM-dd", "&centro="
- GetCalendarioAsync(i4, valuetype:209) → class:385<class:373>
    strings: "api/v1/calendarios/"
- GetCalendarioPorMatriculaAsync(valuetype:321, i4, valuetype:209) → class:385<class:373>
    strings: "api/v1/calendarios/porMatricula?fecha=", "yyyy-MM-dd", "&matricula="
- GetCalendariosDuplicadosAsync(valuetype:209) → class:385<class:337<class:373>>
    strings: "api/v1/calendarios/duplicados"
- GetCalendarioBasicoDeConductorAsync(valuetype:321, i4, valuetype:209) → class:385<class:329>
    strings: "api/v1/calendarios/basicoDeConductor?fecha=", "yyyy-MM-dd", "&idConductor="
- GetCalendariosBasicosPorConductorAsync(i4, i4, valuetype:209) → class:385<class:337<class:329>>
    strings: "api/v1/calendarios/basicos?idConductor=", "&año="
- GetCalendariosBasicosPorFechaAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:329>>
    strings: "api/v1/calendarios/basicosPorFecha?fecha=", "yyyy-MM-dd", "&centro="
- GetAnualesBasicosPorFechaAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:329>>
    strings: "api/v1/calendarios/anualesBasicosPorFecha?fecha=", "yyyy-MM-dd", "&centro="
- GetVirtualesBasicosPorFechaAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:329>>
    strings: "api/v1/calendarios/virtualesBasicosPorFecha?fecha=", "yyyy-MM-dd", "&centro="
- GetDiaCalendarioBasicoPorIdAsync(i4, valuetype:209) → class:385<class:429>
    strings: "api/v1/calendarios/diaBasico?id="
- GetCalendariosCrudosPorFechaAsync(valuetype:321, valuetype:317, bool, valuetype:209) → class:385<class:337<class:613>>
    strings: "api/v1/calendarios/diasCalendarioCrudos?fecha=", "yyyy-MM-dd", "&centro=", "&añoCompleto="
- AddCalendarioAsync(class:373) → class:385<class:373>
    strings: "api/v1/calendarios"
- AddCalendariosAsync(class:361<class:373>) → class:357
    strings: "api/v1/calendarios/lista"
- UpdateCalendarioAsync(class:373) → class:357
    strings: "api/v1/calendarios/"
- UpdateCalendariosAsync(class:361<class:373>) → class:357
    strings: "api/v1/calendarios/lista"
- UpdateDiasCalendarioAsync(class:361<class:369>) → class:357
    strings: "api/v1/calendarios/dias/lista"
- DeleteCalendarioAsync(i4) → class:357
    strings: "api/v1/calendarios/"
- DeleteCalendariosAsync(class:361<class:373>) → class:357
    strings: "api/v1/calendarios/lista"
- GetDiasCalendario(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:369>>
    strings: "api/v1/calendarios/diasCalendario?fecha=", "yyyy-MM-dd", "&centro="
- GetDiaCalendario(valuetype:321, i4, valuetype:209) → class:385<class:369>
    strings: "api/v1/calendarios/diasCalendario/dia?fecha=", "yyyy-MM-dd", "&idConductor="
- MarcarFestivosAsync(valuetype:321, valuetype:317, valuetype:209) → class:357
    strings: "api/v1/calendarios/marcarFestivos?fecha=", "yyyy-MM-dd", "&centro="
- AjustarJDsAsync(valuetype:321, valuetype:317, valuetype:209) → class:357
    strings: "api/v1/calendarios/ajustarJds?fecha=", "yyyy-MM-dd", "&centro="
- RecalcularResumenes(valuetype:321, valuetype:317, valuetype:209) → class:357
    strings: "ATENCIÓN", "Vas a recalcular los resúmenes de todos los calendarios.\n\n¿Quieres continuar?", "Recalculando resúmenes", "api/v1/calendarios/recalcularResumenes?fecha=", "yyyy-MM-dd", "&centro="
- RegenerarTodos(valuetype:321, valuetype:317, valuetype:209) → class:357
    strings: "ATENCIÓN", "Vas a modificar los tres servicios de todos los calendarios.\n\nEsta acción puede provocar pérdida de datos en los servicios virtuales\n\n¿Quieres continuar?", "Regenerando calendarios", "api/v1/calendarios/regererarTodos?fecha=", "yyyy-MM-dd", "&centro="
- GetResumenesHastaMesEnAñoAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:637>>
    strings: "api/v1/resumenes/hastaMesEnAño?hasta=", "yyyy-MM-dd", "&centro="
- GetResumenHastaMesEnAñoAsync(valuetype:321, i4, valuetype:209) → class:385<class:637>
    strings: "api/v1/resumenes/hastaMesEnAño/conductor?hasta=", "yyyy-MM-dd", "&matricula="
- GetResumenHastaMesAsync(i4, valuetype:321, valuetype:209) → class:385<class:637>
    strings: "api/v1/resumenes/hastaMes?matricula=", "&hasta=", "yyyy-MM-dd"
- GetResumenHastaNoviembreAñoAnteriorAsync(i4, valuetype:321, valuetype:209) → class:385<class:637>
    strings: "api/v1/resumenes/hastaNoviembreAñoAnterior?matricula=", "&hasta=", "yyyy-MM-dd"
- GetErroresCalendarioFechaAsync(valuetype:321, valuetype:317, valuetype:209) → class:385<class:337<class:589>>
    strings: "api/v1/resumenes/errores?fecha=", "yyyy-MM-dd", "&centro="
- DeleteFestivosAsync(class:361<class:489>) → class:357
    strings: "api/v1/convenios/festivos/lista"
- GetReclamacionesAsync(i4, valuetype:209) → class:385<class:337<class:553>>
    strings: "api/v1/reclamaciones?idConductor="
- GetReclamacionPorFechaAsync(valuetype:321, i4, valuetype:209) → class:385<class:553>
    strings: "api/v1/reclamaciones/porFecha?fecha=", "yyyy-MM-dd", "&idConductor="
- AddReclamacionAsync(class:553) → class:385<class:553>
    strings: "api/v1/reclamaciones"
- AddReclamacionesAsync(class:361<class:553>) → class:357
    strings: "api/v1/reclamaciones/lista"
- UpdateReclamacionAsync(class:553) → class:357
    strings: "api/v1/reclamaciones/"
- UpdateReclamacionesAsync(class:361<class:553>) → class:357
    strings: "api/v1/reclamaciones/lista"
- DeleteReclamacionAsync(i4) → class:357
    strings: "api/v1/reclamaciones/"
- DeleteReclamacionesAsync(class:361<class:553>) → class:357
    strings: "api/v1/reclamaciones/lista"
- ExisteReclamacionAsync(valuetype:321, i4, valuetype:209) → class:385<bool>
    strings: "api/v1/reclamaciones/existe?fecha=", "yyyy-MM-dd", "&idConductor="
- GetConceptosReclamados(i4, valuetype:209) → class:385<class:337<class:557>>
    strings: "api/v1/conceptosReclamados?idReclamacion="
- GetDCsReclamadosEnCursoHastaMes(valuetype:321, i4, valuetype:209) → class:385<valuetype:597>
    strings: "api/v1/reclamaciones/dcsReclamados?fecha=", "yyyy-MM-dd", "&idConductor="
- GetDNDsReclamadosEnCursoHastaMes(valuetype:321, i4, valuetype:209) → class:385<valuetype:597>
    strings: "api/v1/reclamaciones/dndsReclamados?fecha=", "yyyy-MM-dd", "&idConductor="
- AddConceptosReclamadosAsync(class:361<class:557>) → class:357
    strings: "api/v1/conceptosReclamados/lista"
- UpdateConceptosReclamadosAsync(class:361<class:557>) → class:357
    strings: "api/v1/conceptosReclamados/lista"
- DeleteConceptoReclamadoAsync(i4) → class:357
    strings: "api/v1/conceptosReclamados/"
- DeleteConceptosReclamadosAsync(class:361<class:557>) → class:357
    strings: "api/v1/conceptosReclamados/lista"
- ExisteConceptoReclamadoAsync(valuetype:321, i4, valuetype:209) → class:385<bool>
    strings: "api/v1/conceptosReclamados/existe?fecha=", "yyyy-MM-dd", "&idReclamacion="
- GetConceptosReclamadosExtendidosPorMes(valuetype:321, valuetype:317, valuetype:277<valuetype:601>, valuetype:277<valuetype:605>, valuetype:209) → class:385<class:569<class:593>>
    strings: "api/v1/reclamaciones/estadisticas/conceptosMes?fecha=", "yyyy-MM-dd", "&centro=", "&categoria=", "&situacion="
- GetConceptosReclamadosExtendidosPorAño(i4, valuetype:317, valuetype:277<valuetype:601>, valuetype:277<valuetype:605>, valuetype:209) → class:385<class:569<class:593>>
    strings: "api/v1/reclamaciones/estadisticas/conceptosAño?año=", "&centro=", "&categoria=", "&situacion="
- GetAsignacionesGraficosParaMes(valuetype:321, valuetype:317, bool, valuetype:209) → class:385<class:569<class:573>>
    strings: "api/v1/calendarios/estadisticas/asignacionGraficos?fecha=", "yyyy-MM-dd", "&centro=", "&lunvie="
- GetNominaByIdAsync(i4, valuetype:209) → class:385<class:545>
    strings: "api/v1/nominas/"
- GetNominasAsync(i4, valuetype:209) → class:385<class:337<class:545>>
    strings: "api/v1/nominas?idConductor="
- GetNominaPorFechaAsync(valuetype:321, i4, valuetype:209) → class:385<class:545>
    strings: "api/v1/nominas/porFecha?fecha=", "yyyy-MM-dd", "&idConductor="
- AddNominaAsync(class:545) → class:385<class:545>
    strings: "api/v1/nominas"
- AddNominasAsync(class:361<class:545>) → class:357
    strings: "api/v1/nominas/lista"
- UpdateNominaAsync(class:545) → class:357
    strings: "api/v1/nominas/"
- UpdateNominasAsync(class:361<class:545>) → class:357
    strings: "api/v1/nominas/lista"
- DeleteNominaAsync(i4) → class:357
    strings: "api/v1/nominas/"
- DeleteNominasAsync(class:361<class:545>) → class:357
    strings: "api/v1/nominas/lista"
- GetIdNominaAsync(valuetype:321, i4, valuetype:209) → class:385<i4>
    strings: "api/v1/nominas/id?fecha=", "yyyy-MM-dd", "&idConductor="
- GenerarNominaAsync(valuetype:321, i4, valuetype:209) → class:385<class:545>
    strings: "api/v1/nominas/generar?fecha=", "yyyy-MM-dd", "&idConductor="
- RecalcularNominaAsync(valuetype:321, i4, valuetype:209) → class:357
    strings: "api/v1/nominas/recalcular?fecha=", "yyyy-MM-dd", "&idConductor="


