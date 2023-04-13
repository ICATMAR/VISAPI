#!/usr/bin/python
# -*- coding: UTF-8 -*-

# ---------------------------------------------------------
# Database connection and queries
# Author: Emilio Garcia & Justino Martinez, modified by Gerard Llorach
# Date: 26/5/2021
# Version: 0.0.0
# ---------------------------------------------------------

# To give permissions
# https://dzone.com/articles/python-simple-http-server-with-cgi-scripts-enabled
# To start dev server:
# python -m http.server --cgi 8000
# Go to http://127.1.1.1:8000/cgi-bin/visapdb.py?query=portBiomass

import cgi
import cgitb
import simplejson as json  # for decimal encoding in JSON
import psycopg2  # for PosgreSQL queries
from psycopg2.extras import RealDictCursor # For JSON formatting (https://www.peterbe.com/plog/from-postgres-to-json-strings)
import re  # for regex expressions
# import logging
import os
import sys
import io  # For UTF-8 encoding



# ---------------------------------------------------------
# Database connection
# ---------------------------------------------------------

def conectadb():
    # Load credentials json
    with open("/var/www/vhosts/geobluenetcat.icm.csic.es/cgi-bin/credentials.json") as credentialsFile:

        credentials = json.load(credentialsFile)
    PARAMS = {'database': credentials["database"], 'user': credentials["user"], 'password': credentials["password"],
              'host': credentials["host"], 'port': credentials["port"]}
    conn = psycopg2.connect(**PARAMS)
    return conn


# ---------------------------------------------------------
# Function getDataFromQuery
# Description   : Makes a query to the database
# Input         : Query string, e.g. SELECT * FROM "sample"
# Output        : JSON containing the output of the query
# ---------------------------------------------------------

def getDataFromQuery(query):
    db = conectadb().cursor(cursor_factory=RealDictCursor)  # https://www.peterbe.com/plog/from-postgres-to-json-strings
    db.execute(query)
    items = db.fetchall()
    db.close()
    return json.JSONEncoder(ensure_ascii=False, encoding='utf-8').encode(items) # https://simplejson.readthedocs.io/en/latest/


# -----------------------------
# LOGGING INSTRUCTIONS
# -----------------------------
'''
DEBUG
Detailed information, typically of interest only when diagnosing problems.

INFO
Confirmation that things are working as expected.

WARNING
An indication that something unexpected happened, or indicative of some problem in the near future (e.g. ‘disk space low’). The software is still working as expected.

ERROR
Due to a more serious problem, the software has not been able to perform some function.

CRITICAL
A serious error, indicating that the program itself may be unable to continue running.

If you want to set the logging level from a command-line option such as:
--log=INFO
and you have the value of the parameter passed for --log in some variable loglevel, you can use:

getattr(logging, loglevel.upper())
'''

'''
logging.basicConfig(filename='/var/www/vhosts/cosmo.icm.csic.es/httpdocs/t.log', filemode='w', level=logging.DEBUG)
logging.info(os.getenv('HTTP_REFERER'))

logging.debug('This message should go to the log file')
logging.info('So should this')
logging.warning('And this, too')
'''

###############  END LOGGING

# Check referer
'''r=os.getenv('HTTP_REFERER')

if str(r).find("https://geobluenetcat.icm.csic.es/") < 0:
    result={'Error':'Incorrect use'}
    print("Content-type: application/json ;charset=utf-8")
    print("")
    print(json.JSONEncoder().encode(result))
    sys.exit()'''

# Read input
data = {}
cgitb.enable()
form = cgi.FieldStorage()

# Make query according to input
# Biomass by port
if "query" in form:
    queryName = form.getvalue("query")
    if queryName == "portBiomass":
        query = 'SELECT * FROM "abu_bio_by_port"'
        result = getDataFromQuery(query)
    # Biomass by season
    elif queryName == "seasonBiomass":
        query = 'SELECT * FROM "abu_bio_by_season"'
        result = getDataFromQuery(query)
    # Track lines
    elif queryName == "trackLines":
        query = "SELECT \"haul\".\"Id\" as \"Id\", \"haul\".\"AvgDepth\", \"haul\".\"FishingGroundName\", \"haul\".\"FishingGroundType\", \"haul\".\"MeshType\", \"trackLines\".\"Duration\", \"trackLines\".\"Distance\", \"trackLines\".\"geom\", \"cruise\".\"Season\" as \"Estacio\", to_char(\"cruise\".\"Date\", 'YYYY-MM-DD') as \"Data\", \"port\".\"Area\" as \"ZonaPort\", \"port\".\"Name\" as \"Port\" FROM \"trackLines\" INNER JOIN \"haul\" ON \"trackLines\".\"HaulId\" = \"haul\".\"Id\" INNER JOIN \"cruise\" ON \"haul\".\"CruiseId\" = \"cruise\".\"Id\" INNER JOIN \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" WHERE \"trackLines\".\"geom\" IS NOT NULL AND \"cruise\".\"Validated\" = \'true\'";
        result = getDataFromQuery(query)
    # Length frequency
    elif queryName == "sizes":
        query = 'SELECT * FROM "sf_by_area"'
        result = getDataFromQuery(query)
    # Get the sample of a haul (species' biomass caught in a haul)
    elif queryName == "haulSpecies":
        if "HaulId" in form:
            haulId = str(form.getvalue("HaulId"))  # Read value and make sure it is a string
            haulIdClean = re.sub(r'[^\d]+', '', haulId)  # Keep digits only
            query = "SELECT \"species\".\"ScientificName\" as \"NomEspecie\", \"species\".\"CatalanName\" as \"NomComu\", sum(\"sample\".\"Biomass\") as \"Biomassa\", CASE WHEN \"species\".\"IsWaste\" THEN 'Residus' WHEN \"sample\".\"Category\" = 'Rebuig' or \"sample\".\"Category\" = 'No comercial' THEN 'Rebuig' ELSE 'Comercial' END AS \"ClassificacioCaptura\" FROM \"sample\" INNER JOIN \"haul\" ON \"sample\".\"HaulId\" = \"haul\".\"Id\" INNER JOIN \"cruise\" ON \"haul\".\"CruiseId\" = \"cruise\".\"Id\" inner join \"species\" on \"sample\".\"SpecieId\" = \"species\".\"Id\" inner join \"port\" on \"cruise\".\"PortId\" = \"port\".\"Id\" WHERE \"sample\".\"HaulId\" = '0000' group by \"species\".\"ScientificName\", \"species\".\"CatalanName\", \"ClassificacioCaptura\"";
            tQuery = query.replace('0000', haulIdClean)  # Assign haul Id to query
            result = getDataFromQuery(tQuery)
        else:
            result = {"Error": "No HaulId in query"}
    else:
        result = {"Error": "query name not found. Try with visapdb.py?query=portBiomass"}
else:
    result = {"Error": "query not defined. Try with visapdb.py?query=portBiomass"}



# Output...
# Set the utf-8 enconding of the output for the web client
ssout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # https://stackoverflow.com/Questions/4374455/how-to-set-sys-stdout-encoding-in-python-3

ssout.write("Content-type: application/json;charset=utf-8\n")
ssout.write("\n")
ssout.write(str(result))  # From dict to str
ssout.write("\n")
ssout.flush()


# Test Query
# var results = fetch("http://localhost:8080/yearBiomass").then(r => r.json()).then(console.log)
# var haulId = '4694'; var results = fetch("http://localhost:8080/haulSpecies?HaulId=" + haulId).then(r => r.json()).then(r => results = r).catch(e => console.log(e))
# https://cosmo.icm.csic.es/cgi-bin/cosmodb.py?datini=1986-01-01&datfin=2010-01-01&lonsup=-9.550783395767207&latsup=41.24438228702391&loninf=-10.816405177116392&latinf=40.23217632831043&type=0&bboxtype=1
# https://geobluenetcat.icm.csic.es/cgi-bin/visapdb.py?query=trackLines
# https://geobluenetcat.icm.csic.es/cgi-bin/visapdb.py?query=haulSpecies&HaulId='4694'
# http://127.1.1.1:8000/cgi-bin/visapdb.py?query=portBiomass
