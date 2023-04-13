// Code based on:
// http://duspviz.mit.edu/web-map-workshop/leaflet_nodejs_postgis/
// https://www.youtube.com/watch?v=ufdHsFClAk0&ab_channel=HusseinNasser
// https://docs.microsoft.com/en-us/azure/postgresql/connect-nodejs
// https://medium.com/swlh/create-a-rest-api-with-nodejs-and-postgresql-b74369f83ea2

// Written by Gerard Llorach, gllorach (at) fbg.ub.edu, March 2021

// To install node
// https://nodejs.org/es/download/
// Go to the project's folder to node install dependencies
// npm i express pg fs
// To start the server
// node main.js
// TODO: daemon to restart nodejs when restarting computer

// For the REST API
const express = require('express'); // require Express
// PostgreSQL and PostGIS module and connection setup
const Pool = require('pg').Pool;
// To write and read files from disk
const fs = require('fs');
// Credentials for the database
const credentials = require('./credentials.json');
// Pool postgre
const pool = new Pool(credentials);

// Create REST API
const app = express();
const port = 8080;



// Set up your database query
var trawlingQuery = "SELECT \"Id\", \"Date\", \"PortId\", \"FishingArtName\", \"Season\" FROM public.cruise WHERE \"FishingArtName\" = 'ARROSSEGAMENT'";
var byPortQuery = "SELECT * FROM \"abu_bio_by_port_eng\"";
var tablesQuery = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'";
var bySampleQuery = "SELECT \"SpecieId\", \"HaulId\",\"Biomass\" FROM \"sample\"";

//var byPortBiomassQuery = "WITH \"abHaul\" as ( select \"port\".\"Name\" as \"NomPort\", \"port\".\"Area\" as \"ZonaPort\", \"cruise\".\"FishingArtName\" as \"TipusPesca\", \"haul\".\"Code\", \"species\".\"ScientificName\" as \"NomEspecie\", CASE WHEN \"species\".\"IsWaste\" THEN 'Residus' WHEN \"sample\".\"Category\" = 'Rebuig' or \"sample\".\"Category\" = 'No comercial' THEN 'Rebuig' ELSE 'Comercial' END AS \"ClassificacioCaptura\", \"species\".\"WasteType\" as \"TipusResidus\", \"species\".\"CatalanName\" as \"NomCatala\", sum(\"sample\".\"Abundance\") as \"SumaAbundancia\", sum(\"sample\".\"Biomass\") as \"SumaBiomassa\" from \"sample\" inner join \"haul\" on \"sample\".\"HaulId\" = \"haul\".\"Id\" inner join \"cruise\" on \"haul\".\"CruiseId\" = \"cruise\".\"Id\" inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" inner join \"vessel\" on \"cruise\".\"VesselId\" = \"vessel\".\"Id\" inner join \"species\" on \"sample\".\"SpecieId\" = \"species\".\"Id\" where \"ProjectId\" = 1 and \"Date\"<'2021-01-01' and \"FishingArtName\"='ARROSSEGAMENT' group by \"port\".\"Name\", \"port\".\"Area\", \"cruise\".\"FishingArtName\", \"haul\".\"Code\", \"species\".\"ScientificName\", \"ClassificacioCaptura\", \"species\".\"WasteType\", \"species\".\"CatalanName\" ) select \"NomPort\", \"ZonaPort\", \"TipusPesca\", \"NomEspecie\", \"ClassificacioCaptura\", \"TipusResidus\", \"NomCatala\", avg(\"SumaAbundancia\") as \"Abundancia_NIndividus_Km2\", avg(\"SumaBiomassa\") as \"Biomassa_Kg_Km2\" from \"abHaul\" group by \"NomPort\", \"ZonaPort\", \"TipusPesca\", \"NomEspecie\", \"ClassificacioCaptura\", \"TipusResidus\", \"NomCatala\"";

var bySeasonBiomassQuery = "WITH \"abHaul\" as (select \"port\".\"Area\" as \"ZonaPort\", \"cruise\".\"Season\" as \"Estacio\", \"cruise\".\"FishingArtName\" as \"TipusPesca\",\"haul\".\"Code\" as \"CodiPesca\", \"species\".\"ScientificName\" as \"NomEspecie\", \"species\".\"CatalanName\" as \"NomCatala\", CASE WHEN \"species\".\"IsWaste\" THEN 'Residus'	WHEN \"sample\".\"Category\" = 'Rebuig' or \"sample\".\"Category\" = 'No comercial' THEN 'Rebuig'	ELSE 'Comercial'END AS \"ClassificacioCaptura\", \"species\".\"WasteType\" as \"TipusResidus\", sum(\"sample\".\"Abundance\") as \"SumaAbundancia\", sum(\"sample\".\"Biomass\") as \"SumaBiomassa\"	from \"sample\"	inner join \"haul\" on \"sample\".\"HaulId\" = \"haul\".\"Id\"	inner join \"cruise\" on \"haul\".\"CruiseId\" = \"cruise\".\"Id\"	inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\"	inner join \"species\" on \"sample\".\"SpecieId\" = \"species\".\"Id\"	where \"ProjectId\" = 1 and \"Date\"<'2021-01-01' and \"FishingArtName\"='ARROSSEGAMENT' group by \"port\".\"Area\", \"cruise\".\"Season\", \"cruise\".\"FishingArtName\", \"haul\".\"Code\", \"species\".\"ScientificName\", \"species\".\"CatalanName\", \"ClassificacioCaptura\", \"species\".\"WasteType\"), \"countHaul\" as (	select \"port\".\"Area\" as \"ZonaPort\", \"cruise\".\"Season\" as \"Estacio\", \"cruise\".\"FishingArtName\" as \"TipusPesca\",	count(distinct(\"haul\".\"Code\")) as \"NumPesques\" 	from \"haul\"	inner join \"cruise\" on \"haul\".\"CruiseId\" = \"cruise\".\"Id\"	inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\"	where \"ProjectId\" = 1 and \"Date\"<'2021-01-01' and \"FishingArtName\"='ARROSSEGAMENT'	group by \"port\".\"Area\", \"cruise\".\"Season\", \"cruise\".\"FishingArtName\"	)select \"abHaul\".\"ZonaPort\", \"abHaul\".\"Estacio\", \"abHaul\".\"TipusPesca\", \"abHaul\".\"NomEspecie\", \"abHaul\".\"NomCatala\",  \"abHaul\".\"ClassificacioCaptura\", \"abHaul\".\"TipusResidus\", round(sum(\"SumaAbundancia\")/\"NumPesques\",3) as \"Abundancia_NIndividus_Km2\", round(sum(\"SumaBiomassa\")/\"NumPesques\",3) as \"Biomassa_Kg_Km2\" from \"abHaul\" inner join \"countHaul\" on \"abHaul\".\"ZonaPort\"=\"countHaul\".\"ZonaPort\" and \"abHaul\".\"Estacio\"=\"countHaul\".\"Estacio\" and \"abHaul\".\"TipusPesca\"=\"countHaul\".\"TipusPesca\" group by \"abHaul\".\"ZonaPort\", \"abHaul\".\"Estacio\", \"abHaul\".\"TipusPesca\", \"abHaul\".\"NomEspecie\", \"abHaul\".\"NomCatala\", \"abHaul\".\"ClassificacioCaptura\",  \"abHaul\".\"TipusResidus\", \"NumPesques\"";

var shortByYearBiomassQuery = "SELECT * from \"abu_bio_by_year_eng\"";
//var byYearBiomassQuery = "WITH \"abHaul\" as ( select date_part('year', \"cruise\".\"Date\") as \"Any\", \"port\".\"Area\" as \"ZonaPort\", \"cruise\".\"Season\" as \"Estacio\", \"cruise\".\"FishingArtName\" as \"TipusPesca\", \"haul\".\"Code\" as \"CodiPesca\", \"species\".\"ScientificName\" as \"NomEspecie\", \"species\".\"CatalanName\" as \"NomCatala\", CASE WHEN \"species\".\"IsWaste\" THEN 'Residus' WHEN \"sample\".\"Category\" = 'Rebuig' or \"sample\".\"Category\" = 'No comercial' THEN 'Rebuig' ELSE 'Comercial' END AS \"ClassificacioCaptura\", \"species\".\"WasteType\" as \"TipusResidus\", sum(\"sample\".\"Abundance\") as \"SumaAbundancia\", sum(\"sample\".\"Biomass\") as \"SumaBiomassa\" from \"sample\" inner join \"haul\" on \"sample\".\"HaulId\" = \"haul\".\"Id\" inner join \"cruise\" on \"haul\".\"CruiseId\" = \"cruise\".\"Id\" inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" inner join \"species\" on \"sample\".\"SpecieId\" = \"species\".\"Id\" where \"ProjectId\" = 1 and \"Date\"<'2021-01-01' and \"FishingArtName\"='ARROSSEGAMENT' group by date_part('year', \"cruise\".\"Date\"), \"port\".\"Area\", \"cruise\".\"Season\", \"cruise\".\"FishingArtName\", \"haul\".\"Code\", \"species\".\"ScientificName\", \"species\".\"CatalanName\", \"ClassificacioCaptura\", \"species\".\"WasteType\" ), \"countHaul\" as ( select date_part('year', \"cruise\".\"Date\") as \"Any\", \"port\".\"Area\" as \"ZonaPort\", \"cruise\".\"Season\" as \"Estacio\", \"cruise\".\"FishingArtName\" as \"TipusPesca\", count(distinct(\"haul\".\"Code\")) as \"NumPesques\" from \"haul\" inner join \"cruise\" on \"haul\".\"CruiseId\" = \"cruise\".\"Id\" inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" where \"ProjectId\" = 1 and \"Date\"<'2021-01-01' and \"FishingArtName\"='ARROSSEGAMENT' group by date_part('year', \"cruise\".\"Date\"), \"port\".\"Area\", \"cruise\".\"Season\", \"cruise\".\"FishingArtName\" ) select \"abHaul\".\"Any\", \"abHaul\".\"ZonaPort\", \"abHaul\".\"Estacio\", \"abHaul\".\"TipusPesca\", \"abHaul\".\"NomEspecie\", \"abHaul\".\"NomCatala\", \"abHaul\".\"ClassificacioCaptura\", \"abHaul\".\"TipusResidus\", round(sum(\"SumaAbundancia\")/\"NumPesques\",3) as \"Abundancia_NIndividus_Km2\", round(sum(\"SumaBiomassa\")/\"NumPesques\",3) as \"Biomassa_Kg_Km2\" from \"abHaul\" inner join \"countHaul\" on \"abHaul\".\"Any\"=\"countHaul\".\"Any\" and \"abHaul\".\"ZonaPort\"=\"countHaul\".\"ZonaPort\" and \"abHaul\".\"Estacio\"=\"countHaul\".\"Estacio\" and \"abHaul\".\"TipusPesca\"=\"countHaul\".\"TipusPesca\" group by \"abHaul\".\"Any\", \"abHaul\".\"ZonaPort\", \"abHaul\".\"Estacio\", \"abHaul\".\"TipusPesca\", \"abHaul\".\"NomEspecie\", \"abHaul\".\"NomCatala\", \"abHaul\".\"ClassificacioCaptura\", \"abHaul\".\"TipusResidus\", \"NumPesques\""
// Get the track lines for the trawling sampled cruises
const trackLinesQuery = "select * from \"track_lines_eng\"";

// Gets the samples for a given haul
const haulSamplesQuery = "SELECT CASE WHEN species_e.\"English\" IS NULL THEN \"species\".\"ScientificName\" ELSE species_e.\"English\" END AS \"NomEspecie\", \"species\".\"EnglishName\" as \"NomComu\", sum(\"sample\".\"Biomass\") as \"Biomassa\", classification_e.\"English\" AS \"ClassificacioCaptura\" FROM \"sample\" INNER JOIN \"haul\" ON \"sample\".\"HaulId\" = \"haul\".\"Id\" INNER JOIN \"cruise\" ON \"haul\".\"CruiseId\" = \"cruise\".\"Id\" inner join \"species\" on \"sample\".\"SpecieId\" = \"species\".\"Id\" inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" LEFT JOIN translation classification_e ON sample.\"Classification\"::text = classification_e.\"Catalan\"::text LEFT JOIN translation species_e ON \"species\".\"ScientificName\"::text = species_e.\"Catalan\"::text WHERE \"sample\".\"HaulId\" = '0000' group by species_e.\"English\", \"species\".\"ScientificName\", \"species\".\"EnglishName\", \"ClassificacioCaptura\"";

// Get the frequency of sizes given a species
const sizesQuery = "SELECT * FROM \"sf_by_area_eng\"";//\"sf_by_year\"";
// Get color palette
const paletteQuery = "SELECT * FROM \"color_palette_eng\"";
// Get translations
const translationsCaQuery = "SELECT * FROM \"translation_ca\"";
const translationsEsQuery = "SELECT * FROM \"translation_es\"";
const translationsEnQuery = "SELECT * FROM \"translation_en\"";
//const translationsFrQuery = "SELECT * FROM \"translation_fr\"";


// Set headers for REST API
const setHeaders = (req, res) => {
  // Set headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // To be able to fetch from everywhere. TODO: write the final domain
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  req.setTimeout(5000); //https://stackoverflow.com/questions/23925284/how-to-modify-the-nodejs-request-default-timeout-time
}

// REST API - GET Postgres JSON data
// To fetch it from the client:
// fetch("http://localhost:8080/portBiomass").then(r => r.json()).then(console.log)
// TODO: generalize the "get" (repeated code in all app.get)
app.get('/portBiomass', function (req, res) {
  // Set headers
  setHeaders(req, res);
  // Query
  pool.query(byPortQuery)
    .then(results => res.json(results.rows))
    .catch(err => res.send(err))
    .finally(() => res.end());

});

// Per season
app.get('/seasonBiomass', function (req, res) {
  // Set headers
  setHeaders(req,res);
  // Query
  pool.query(bySeasonBiomassQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
});
// Per year
// fetch("http://localhost:8080/yearBiomass").then(r => r.json()).then(console.log)
app.get('/yearBiomass', function (req, res) {
  // Set headers
  setHeaders(req,res);
  // Query
  //pool.query(byYearBiomassQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
  pool.query(shortByYearBiomassQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
});

// Get track lines
app.get('/trackLines', function(req, res){
  // Set headers
  setHeaders(req,res);
  pool.query(trackLinesQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
});


// Get the sample (species caught in a haul)
// var haulId = '4694';
//var results = fetch("http://localhost:8080/haulSpecies?HaulId=" + haulId).then(r => r.json()).then(r => results = r).catch(e => console.log(e))
app.get('/haulSpecies', function(req,res){
  // Set headers
  setHeaders(req,res);
  // Process GET input
  let tQuery = haulSamplesQuery;
  // Regex experssion to check that it only contains numbers
  let regExpression = new RegExp('^[0-9]+$');
  // Check if information exists
  if (req.query === undefined)
    console.log("No query");
  else if (req.query.HaulId === undefined)
    console.log("No 'HaulId' in query")
  else if (req.query.HaulId !== undefined && regExpression.test(req.query.HaulId)) {
    tQuery = haulSamplesQuery.replace('0000', req.query.HaulId);
    console.log("Haul Id: " + req.query.HaulId);
  }
  pool.query(tQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
});

// Get frequency of sizes (freqüència talles)
app.get('/sizes', function(req, res){
  // Set headers
  setHeaders(req,res);
  pool.query(sizesQuery).then(results => res.json(results.rows)).catch(err => res.send(err)).finally(() => res.end());
});


var server = app.listen(port, () => {console.log("Server starting on port : " + port);});
server.timeout = 1000; //https://stackoverflow.com/questions/23925284/how-to-modify-the-nodejs-request-default-timeout-time

// TODO: create an automatic git commit every now and then of the data from the database...
// Info about commiting to git: https://stackoverflow.com/questions/18086955/nodejs-git-pull-commit-and-push-with-child-process


// Get the trackLines and generate static files for each HaulId
function generateHaulStaticFiles(){
  // Track lines query
  pool.query(trackLinesQuery).
  then(results => {
    let tmpRes = results.rows;
    tmpRes.forEach(el => {
      tQuery = haulSamplesQuery.replace('0000', el.Id);
      // Haul query
      saveJSON(tQuery, 'hauls/'+ el.Id) // TODO make it prettier with '0003.json' instead of '3.json'
    });
  }).catch(err => console.log(err));
}


// Store automatically the data in a json file
function saveJSON(tQuery, filename){
  pool.query(tQuery)
      .then(results => fs.writeFile('../VISAP/data/' + filename + '.json',
                          JSON.stringify(results.rows),
                          'utf8',
                          (err) => err ? console.log(err) : console.log('JSON '+ filename +' from database written successfully.')
                        ))
      .catch(er => console.log(er))
}

// Store automatically the data in a js file
function saveJS_palette(tQuery, filename){
  let aux_str = 'var palette = {';
  pool.query(tQuery).
  then(results => {
    let tmpRes = results.rows;
    tmpRes.forEach(el => {
      aux_str += '"' + el.Name + '": {"color": [' + el.R + ', ' + el.G + ', ' + el.B + ']},';      
    });
    aux_str += '}'
    fs.writeFile('../VISAP/data/' + filename + '.js',
                          aux_str,
                          'utf8',
                          (err) => err ? console.log(err) : console.log('JS '+ filename +' from database written successfully.')
                        )
  }).catch(err => console.log(err))  
}

// Store automatically the data in a js file
function saveJS_translation(tQuery, filename){
  let aux_str = 'let ' + filename + ';\n';
  aux_str += 'export default ' + filename + ' = {\n';
  pool.query(tQuery).
  then(results => {
    let tmpRes = results.rows;
    tmpRes.forEach(el => {
      aux_str += '"' + el.English + '": "' + el.Translation + '",\n';      
    });
    aux_str += '}';
    fs.writeFile('../VISAP/lang/' + filename + '.js',
                          aux_str,
                          'utf8',
                          (err) => err ? console.log(err) : console.log('JS '+ filename +' from database written successfully.')
                        );      
  }).catch(err => console.log(err)); 

}

// Uncomment the following lines to generate the needed static files

//saveJSON(byPortQuery, "pesca_arrossegament_port_biomassa");
//saveJSON(shortByYearBiomassQuery, "pesca_arrossegament_any_biomassa");

//saveJSON(bySeasonBiomassQuery, "pesca_arrossegament_estacio_biomassa");
//saveJSON(bySampleQuery, "samples");

//saveJSON(trackLinesQuery, "trackLines");
//generateHaulStaticFiles();

//saveJSON(sizesQuery, "sizes");
//saveJS_palette(paletteQuery, "palette");

saveJS_translation(translationsCaQuery, 'species_ca');
saveJS_translation(translationsEsQuery, 'species_es');
saveJS_translation(translationsEnQuery, 'species_en');
//saveJS_translation(translationsFrQuery, 'fr');
