## Contents


## Return data

Data is always returned in JSON format. It is always of this format:

```
\{~success:~true/false,~value:~\textless{}response~data\textgrea
ter{}~\}
```
- Thesuccessproperty tells if the API call was successful
- Thevalueproperty contains the relevant data for the call (if the API call

- Return data
- Login
   - HTTP Basic auth
- Methods
   - Get my group.
   - Get all groups.
   - Get all zones
   - Get all distribution zones with stats
   - Get zone stats with equipages.
   - Get all lines.
   - Get all equipages.
   - Get misc consignments by date
   - NEW! Get distribution consignments by date
   - Get consignments by zone and date.
   - Get consignments by zonefilter and date.
   - Get consignments by zonegroup and date
   - Get line stats by id and date
   - Get consignments by equipage and date
   - Get consignment info.
   - Get all consignments on boursen
   - Accept a consignment from boursen
   - Set status of consignment
   - Set consignment's equipage
   - Set consignment's zone (line)
   - Set consignment's zoneFilter (zone).
   - Set received by equipage.
   - Set waybillnumber
   - Set invoice status.
   - Unload consignment from equipage.
   - Add alarm from GuardSystems
   - Assign booking number to consignment (undeployed).
   - Insert consignment.
   - Insert unbooked consignment
   - Get consignment updates
   - Get consignment's sms text
   - Send consignment's sms
   - Insert attachment.
   - Insert geoposition.
   - Get freight payers
   - Update freight payers
- Driver functions
   - Log in
   - getConsignment(s) by waybillnumber (implemented)
   - getEquipage(s) by userId (implemented).
   - setStatus (implemented).
   - setEquipage.
   - setEquipage for iLog Driver App
   - RollOn.
   - RollOff (by consignmentId)
   - RollOff (by waybillnumber)
   - Delivered (implemented).
   - Get deviationTypes (implemented).
   - Get deviations for consignment (implemented)
   - Add deviation (implemented)
   - Update deviation.
   - Remove deviation (implemented)
   - Get eventypes (implemented)
   - Register event.
   - Register event by waybillnumber
   - Update consignment paramters
   - Update comments in consignment
   - Add equipage cleaning log.
   - Set positioning in consignment
   - Set pickupDate in consignment
   - Set missReason in consignment
- Chat functions
   - getThreads
   - getThread.
   - requestConsignmentAction


## Login

### HTTP Basic auth

- Auth string: username/transporterNumber:password

## Methods

### Get my group.

- Method:GET
- URL:/ilog-api-web/group
- Returns logged in users group
- Example:https://ilog.btf.se/ilog-api-web/group

### Get all groups.

- Method:GET
- URL:/ilog-api-web/groups
- Returns all available groups
- Example:https://ilog.btf.se/ilog-api-web/groups

### Get all zones

- Method:GET
- URL:/ilog-api-web/zones
- Query parameters:
    **- date** Date for statistics, format:yyyyMMdd
    **- withEquipages** not required, default true format:true\or\false
- Returns tree structure of all zones and their equipages (if withEquipages
    not set to false)
- Example:https://ilog.btf.se/ilog-api-web/zones?date=
    0\&withEquipages=false

### Get all distribution zones with stats

- Method:GET
- URL:/ilog-api-web/distributionZones
- Query parameters:
    **- date** Date for statistics, format:yyyyMMdd
    **- withEquipages** not required, default true format:true\or\false
- Returns tree structure of all distribution zones and their equipages (if
    withEquipages not set to false)
- Example:https://ilog.btf.se/ilog-api-web/distributionZones?
    date=20220308\&withEquipages=false


### Get zone stats with equipages.

- Method:GET
- URL:/ilog-api-web/zone/equipages
- Query parameters:
    **- date** Date for statistics, format:yyyyMMdd
    **- type** type: zone, zonefilter, zonegroup; case insensitive
    **- id** id of zone
- Returns tree structure of all zones and their equipages
- Example:https://ilog.btf.se/ilog-api-web/zone/equipages?dat
    e=20180315\&id=1\&type=zone

### Get all lines.

- Method:GET
- URL:/ilog-api-web/lines
- Returns all zones and zoneFilters

mine:~TRUE~-~~zones/zoneFilters~shown~in~main~view~~
mine:~FALSE~-~zones/zoneFilters~other~lines~in~the~group~~

\{
"success":~true,
"value":~
~{[}
~~~\{
~~~~~"mine":~true,
~~~~~"name":~"Linje",
~~~~~"id":~1,
~~~~~"type":~"ZONE",
~~~~~"publicId":~
~~~\},
~~~\{
~~~~~"mine":~true,
~~~~~"name":~"Zon",
~~~~~"id":~1,
~~~~~"type":~"ZONEFILTER",
~~~~~"publicId":~
~~~\},
~~~\{
~~~~~"mine":~false,
~~~~~"name":~"notMine",
~~~~~"id":~2,
~~~~~"type":~"ZONEFILTER",
~~~~~"publicId":~
~~~\}
~{]}


#### \}

- Example:https://ilog.btf.se/ilog-api-web/lines

### Get all equipages.

- Method:GET
- URL:/ilog-api-web/equipages
- Query parameters:
    **- NONE**
- Returns list of all the equipages
- Example:https://ilog.btf.se/ilog-api-web/equipages

### Get misc consignments by date

- Method:GET
- URL:/ilog-api-web/misc/consignments
- Query parameters:
    **- date** Date to fetch consignments by, format:yyyyMMdd
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/misc/consignments?
    date=

### NEW! Get distribution consignments by date

- Method:GET
- URL:/ilog-api-web/distribution/consignments
- Query parameters:
    **- date** Date to fetch consignments by, format:yyyyMMdd
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/distribution/consi
    gnments?date=

### Get consignments by zone and date.

- Method:GET
- URL:/ilog-api-web/zone/consignments
- Query parameters:
    **- date** Date to fetch consginments by, format:yyyyMMdd
    **- zoneId** id (integer) of zone to fetch consignments by
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/zone/consignments?
    date=20110630\&zoneId=


### Get consignments by zonefilter and date.

- Method:GET
- URL:/ilog-api-web/zonefilter/consignments
- Query parameters:
    **- date** Date to fetch consginments by, format:yyyyMMdd
    **- zoneFilterId** id (integer) of zonefilter to fetch consignments by
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/zonefilter/consign
    ments?date=20110630\&zoneFilterId=

### Get consignments by zonegroup and date

- Method:GET
- URL:/ilog-api-web/zonegroup/consignments
- Query parameters:
    **- date** Date to fetch consginments by, format:yyyyMMdd
    **- zoneGroupId** id (integer) of zonegroup to fetch consignments by
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/zonegroup/consignm
    ents?date=20110630\&zoneGroupId=

### Get line stats by id and date

- Method:GET
- /misc/stats?date=yyyyMMdd
- /zone/stats?date=yyyyMMdd&zoneId=<zoneId>
- /zonefilter/stats?date=yyyyMMdd&zoneFilterId=<zoneFilterId>
- /zonegroup/stats?date=yyyyMMdd&zoneGroupId=<zoneGroupId>
- /equipage/stats?date=yyyyMMdd&equipageId=<equipageId>

### Get consignments by equipage and date

- Method:GET
- URL:/ilog-api-web/equipage/consignments
- Query parameters:
    **- date** Date to fetch consginments by, format:yyyyMMdd
    **- equipageId** id (integer) of equipage to fetch consignments by
- Returns relevant data of the consignments requested
- Example:https://ilog.btf.se/ilog-api-web/equipage/consignme
    nts?date=20110630\&equipageId=


### Get consignment info.

- Method:GET
- URL:/ilog-api-web/consignment
- Query parameters:
    **- consignmentId** id (integer) of the consignment
    **- includeHistory** not required, default false format: true or false
    **- includeEvents** not required, default false format: true or false
- Returns all information about the consignment
- Example:https://ilog.btf.se/ilog-api-web/consignment?consig
    nmentId=

### Get all consignments on boursen

- Method:GET
- URL:/ilog-api-web/bourse/consignments
- Query parameters:
    **- date** Date for consignments, format:yyyyMMdd
- Returns tree structure of all consignments(opened, inbox, outbox) on
    bourse
- Example:https://ilog.btf.se/ilog-api-web/bourse/consignment
    s?date=

### Accept a consignment from boursen

- Method:POST
- URL:/ilog-api-web/bourse/app/acceptItem
- Query parameters:
    **- itemId** Integer for bourse item id
    **- sourceId** Integer for bourse source id
- Returns accept consignment if success
- Example:https://ilog.btf.se/ilog-api-web/bourse/app/acceptI
    tem?acceptItem=1\&sourceId=

### Set status of consignment

- Method:POST
- URL:/ilog-api-web/consignment/setStatus
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- statusTypeId** id (integer) of statustype
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns: success/error
- Example:https://ilog.btf.se/ilog-api-web/consignment/setSta
    tus?consignmentId=6346777\&statusTypeId=


- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setStatus?consignmentId=6346777,6346778,6346779\&statusTyp
    eId=

### Set consignment's equipage

- Method:POST
- URL:/ilog-api-web/consignment/setEquipage
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- equipageId** id (integer) of equipage
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns success/error
- Example:https://ilog.btf.se/ilog-api-web/consignment/setEqu
    ipage?consignmentId=6364436\&equipageId=
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setEquipage?consignmentId=6364436,6364437,6364438\&equipag
    eId=

### Set consignment's zone (line)

- Method:POST
- URL:/ilog-api-web/consignment/setZone
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- zoneId** id (integer) of zone
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns consignment's id (integer)
- Example:https://ilog.btf.se/ilog-api-web/consignment/setZon
    e?consignmentId=6364436\&zoneId=
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setZone?consignmentId=6364436,6364437,6364438\&zoneId=

### Set consignment's zoneFilter (zone).

- Method:POST
- URL:/ilog-api-web/consignment/setZoneFilter
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- zoneFilterId** id (integer) of zoneFilter
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns consignment's id (integer)


- Example:https://ilog.btf.se/ilog-api-web/consignment/setZon
    eFilter?consignmentId=6364436\&zoneFilterId=
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setZoneFilter?consignmentId=6364436,6364437,6364438\&zoneF
    ilterId=

### Set received by equipage.

- Method:POST
- URL:/ilog-api-web/consignment/setReceivedByEquipage
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- receivedTime** received time (long) in milliseconds, not required, if
       null - sets to now
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/setRec
    eivedByEquipage?consignmentId=
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setReceivedByEquipage?consignmentId=6364436,6364437,
    8

### Set waybillnumber

- Method:POST
- URL:/ilog-api-web/consignment/setWaybillnumber
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- waybillnumber** waybillnumber (string)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/setWay
    billnumber?consignmentId=6364436\&waybillnumber=

### Set invoice status.

- Method:POST
- URL:/ilog-api-web/consignment/setInvoiceStatus
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- status** status INVOICED/PENDING
- Note: you can have multiple **consignmentId** parameters to set invoice
    status for several consignments at once
- Returns success
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/setInvoiceStatus?consignmentId=6364436,6364437,6364438\&s


```
tatus=INVOICED
```
### Unload consignment from equipage.

- Method:POST
- URL:/ilog-api-web/consignment/unloadFromEquipage
- Query parameters:
    **- consignmentId** id (integer) of consignment
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns consignment's id (integer)
- Example:https://ilog.btf.se/ilog-api-web/consignment/unload
    FromEquipage?consignmentId=
- Example multiple: https://ilog.btf.se/ilog-api-web/consignmen
    t/unloadFromEquipage?consignmentId=6467355,6467356,

### Add alarm from GuardSystems

- Method:POST
- URL:/ilog-api-web/alarm/sendAlarm
- Returns success/false (Boolean)
- Exemple JSONObject in request body:

\{
~~~~"data":~\{
~~~~~~~~"alert\_time":~"2013-03-04~12:18:45",
~~~~~~~~"customer\_id":~"2024",
~~~~~~~~"id":~"1008089",
~~~~~~~~"message":~"fakealarm",
~~~~~~~~"object\_id":~"13662",
~~~~~~~~"object\_registration\_nr":~"asdf",
~~~~~~~~"temperature":~-40,
~~~~~~~~"temperature\_unit":~"\textbackslash{}u00b0C",
~~~~~~~~"type":~"sensor"
~~~~\},
~~~~"data\_type":~"alarm",
~~~~"message":~"OK",
~~~~"send\_time":~"2013-08-29~06:35:14"
\}

- Example:https://ilog.btf.se/ilog-api-web/alarm/sendAlarm

### Assign booking number to consignment (undeployed).

- Method:POST
- URL:/ilog-api-web/consignment/assignBookingNumber
- Query parameters:


**- consignmentId** id (integer) of consignment
**- bookingNumber** booking number (integer) to assign to consignment
- Returns consignment's id
- Example:https://ilog.btf.se/ilog-api-web/consignment/assign
BookingNumber?consignmentId=3452356\&bookingNumber=
667

### Insert consignment.

- Method:POST
- URL:/ilog-api-web/consignment/insert
- Content-type: application/json
- Returns json with consignmentId (ilogId)
- Example:https://ilog.btf.se/ilog-api-web/consignment/insert
- Authorization with ROLE_API, in that case consignment can end-up in
    only one specific group connected to user with API role)
- Authorization with ROLE_JWR in that case parameters such as zonepub-
    licid, transporternumber and transportername should be specified to find
    right group and line

\{
~"consignment":~\{
~~~"id":~284,
~~~"waybillnumber":~"6047336943",
~~~"transportername":~"VESTMANNALAST~AB",
~~~"increase":~false,
~~~"zonepublicid":~101251234,
~~~"consignmentTypeId":~null,
~~~"originatingman":~910074,
~~~"officeman":~111111,
~~~"opalbookingid":~123456789,
~~~"opalnumber":1234,
~~~"transporternumber":~77777,
~~~"pickupdateto":~1517526000000,
~~~"pickupdatefrom":~1517576400000,
~~~"serviceCodeId":~1,
~~~"weight":~2,~~
~~~"kolli":~1,
~~~"flakmeters":~0,
~~~"pallplaces":~0,
~~~"pall":~0,
~~~"volume":~0,
~~~"width":~0,
~~~"height":~0,
~~~"length":~0,
~~~"halfpall":~0,


~~~"adrcode":~"",
~~~"adrcomment":~"",
~~~"temperatur":~"N",
~~~"bookingnumber":~null,
~~~"positioning":~null,
~~~"estimatedflakmeters":~0,
~~~"estimatedpallplaces":~0,
~~~"estimatedweight":~2,
~~~"estimatedvolume":~0,
~~~"comment":~"Test"
~\},
~"customer":~\{
~~~"name":~"Customer~name"
~\},
~"pickupLocation":~\{
~~~"comment":~"~",
~~~"phoneNumberFax":~null,
~~~"contact":~"NALLE",
~~~"street":~"RÖDA~RIDHUSET",
~~~"areaCode":~"734~94",
~~~"city":~"STRÖMSHOLM",
~~~"phoneNumber":~"0706-262185",
~~~"openFrom":~"",
~~~"openTo":~"",
~~~"lunchFrom":~"",
~~~"lunchTo":~"",
~~~"phoneNumberMobile":~"",
~~~"name":~"STRÖMSHOLMS~RIDSKOLA"
~\},
~"destinationLocation":~\{
~~~"comment":~"",
~~~"phoneNumberFax":~null,
~~~"contact":~"Contact~name",
~~~"street":~"Testgatan~1",
~~~"areaCode":~"72223",
~~~"city":~"VÄSTERÅS",
~~~"phoneNumber":~"",
~~~"openFrom":~"",
~~~"openTo":~"",
~~~"lunchFrom":~"12:00",
~~~"lunchTo":~"13:00",
~~~"phoneNumberMobile":~"",
~~~"name":~"Testmottagare~Testsson"
~\}
\}


Response

\{~
"ilogId":~299,
"receiver":~XXXXX,
"sender":~YYYYY,
"message":~"success",
"status":~
\}

### Insert unbooked consignment

- Method:POST
- URL:/ilog-api-web/consignment/insertUnbooked
- Query parameters:
    **- waybillnumber** waybillnumber (string) required
    **- equipageId** equipageId (Integer) required
    **- customerId** customerId (Integer) not required
    **- destinationCity** destinationCity (String) not required
    **- statusTypeId** statusTypeId (Integer) not required, if null sets to
       status TYPE_PICKEDUP (5)
    **- zoneId** or **zoneFilterId** lineId (Integer) not required, if null sets
       'Övrigt'
- Returns success with consignment
- Example:https://ilog.btf.se/ilog-api-web/consignment/insert
    Unbooked?waybillnumber=1234567890\&equipageId=4\&statusTypeI
    d=2\&zoneId=1\&customerId=1\&destinationCity=Foobartorp

### Get consignment updates

- Method:GET
- URL:/ilog-api-web/consignments/updates
- Param: start as Unix Timestamp with milliseconds
- Returns json with consignment updates from 'start' to now
- Example:https://ilog.btf.se/ilog-api-web/consignments/updat
    es?start=
- Authorization with ROLE_API, in that case updates for consignments
    inserted by same API user
- Authorization with ROLE_JWR in that case updates for consignments
    inserted by same issuer (e.g ilog-sped)

Response

\{
~~"success":true,
~~"value":{[}
~~~~~\{


~~~~~~~~"ilogId":300,
~~~~~~~~"changes":{[}
~~~~~~~~~~~\{
~~~~~~~~~~~~~~"time":1517760467211,
~~~~~~~~~~~~~~"username":"admin/3",
~~~~~~~~~~~~~~"value":"2018-02-04~11:10:00",
~~~~~~~~~~~~~~"field":"pickupdatefrom"
~~~~~~~~~~~\}
~~~~~~~~{]}
~~~~~\},
~~~~~\{
~~~~~~~~"ilogId":302,
~~~~~~~~"changes":{[}
~~~~~~~~~~~\{
~~~~~~~~~~~~~~"time":1517834593652,
~~~~~~~~~~~~~~"username":"admin/3",
~~~~~~~~~~~~~~"value":"5",
~~~~~~~~~~~~~~"field":"statusTypeId"
~~~~~~~~~~~\},
~~~~~~~~~~~\{
~~~~~~~~~~~~~~"time":1517834843742,
~~~~~~~~~~~~~~"username":"admin/3",
~~~~~~~~~~~~~~"value":"6",
~~~~~~~~~~~~~~"field":"statusTypeId"
~~~~~~~~~~~\}
~~~~~~~~{]}
~~~~~\}
~~{]}
\}

### Get consignment's sms text

- Method:GET
- URL:/ilog-api-web/consignment/getSms
- Query parameters:
    **- consignmentId** id (integer) of consignment
- Note: you can have multiple **consignmentId** parameters for many con-
    signments at once
- Returns sms text: message and default number configured in ilog-web:
    defaultMobileNumber
- Example:https://ilog.btf.se/ilog-api-web/consignment/getSms
    ?consignmentId=

"success":~true,
"value":~\{
~"defaultMobileNumber":~"0709319109",


~"message":~"Kund:~Aleksander~testar
~~~~~~~~~~~~~Adress:~Campus~Gräsvik~5~Karlskrona
~~~~~~~~~~~~~Hämttid:~00:00~-~12:
~~~~~~~~~~~~~Goods:~2000~kg
~~~~~~~~~~~~~Anm:~Foobar
~~~~~~~~~~~~~Bokad~av:~Administrator"
\}

### Send consignment's sms

- Method:POST
- URL:/ilog-api-web/consignment/sendSms
- Query parameters:
    **- consignmentId** id (integer) of consignment
    **- mobileNumber** mobileNumber
- Note: you can have multiple **consignmentId** parameters to change several
    consignments at once
- Returns success/error
- Example:https://ilog.btf.se/ilog-api-web/consignment/sendSm
    s?consignmentId=6364436\&mobileNumber=

### Insert attachment.

- Method:POST
- URL:/ilog-api-web/attachment/insert
- Query parameters:
    **- attachment** obligatory multipart/form-data
    **- consignmentId** not required, id (integer) of consignment
    **- equipageId** not required, id (integer) of equipage
    **- description** not required, free text
    **- type** not required, attachment type (TO DISCUSS)
- Note: If consignmentId specified, connection attachment<-> consignment
    will be created
- Note: you can have multiple **consignmentId** parameters to attach same
    attachment to several consignments at once
- Note: If equipageId specified, connection attachment<-> equipage will be
    created
- Note: you can have multiple **equipageId** parameters to attach same
    attachment to several equipages at once
- Returns success/error
- Example:https://ilog.btf.se/ilog-api-web/attachment/insert?
    description=damaged+package\&consignmentId=28965877\&type=da
    mage


### Insert geoposition.

- Method:POST
- URL:/ilog-api-web/addGeopositions
- Body example:

[{
"regno": "ABC123",
"lat": 56.183647,
"long": 15.592362,
"timestamp": "2020-02-11T15:48:50.544Z",
"deviceid": "sendingdeviceid",
"carrierid": 45328,
"reportername": "Fredrik",
"reporterid": "fds"
}]

- Returns Success with status code 200 and ilog-api response object:
    @{”value”:true,”success”:true}@
- Note: Payload can contain multiple records.
- Note: Timestamp in ISO/ECMA format (a.k.a. JSON format).
- Note: Coordinates stored with 6 decimals, should be more than enough.

### Get freight payers

- Method:GET
- URL:/ilog-api-web/getFreightPayers

### Update freight payers

- Method:POST
- URL:/ilog-api-web/updateFreightPayers
- Body example:

[{
"name": "FreightPayer",
"legalName": "Very legal",
"number": "123456",
"organisationNumber": "123456",
"landCode": "SE",
"address": "address",
"city": "Karlskrona",
"areaCode": "12 345",
"country": "Sweden",
"phoneNumber": "708319109",
"email": "ab@c.de",
"paymentTerms": "Pay ASAP",
"paymentDays": 30,


```
"creditorsAccount": "12345",
"currency": "SEK",
"comment": "Comment"
}]
```
- Returns Success with status code 200 and ilog-api response object:
    @{”value”:true,”success”:true}@
- Note: Payload can contain multiple records.
- Note: Freight payer will be updated if found by number in given group,
    otherwise inserted.

## Driver functions

### Log in

- implemented

transporterNumber~för~SDAB~=~
Auth~string:~\textless{}username\textgreater{}/2:\textless{}passw
ord\textgreater{}

### getConsignment(s) by waybillnumber (implemented)

description:

- Method:GET
- URL:/ilog-api-web/consignment/getByWaybillnumber
- Query parameters:
    **- waybillnumber** (string) scanned waybillnumber
- Returns List<CustomConsignment> customConsignments with given
    waybillnumber
- Example:https://ilog.btf.se/ilog-api-web/consignment/getByW
    aybillnumber?waybillnumber=
- Reflections: waybillnumber should be unique, so maybe just return Cus-
    tomConsignment? What if there are 2 or more consignments with the
    same waybillnumber, system allows that.
- TODO:

add~index~on~waybillnumber~(query~takes~long~time)~
CREATE~INDEX~consignments\_group\_id\_waybillnumber\_idx~ON~consi
gnments~(group\_id,~LOWER(waybillnumber)~text\_pattern\_ops);
Main~consignments~index~consignments\_group\_id\_discarded\_statu
stype\_id\_pickupdatefrom\_idx~works,~but~doesnt~do~its~job~(no~s
pecific~date~in~query)


### getEquipage(s) by userId (implemented).

- Method:GET
- URL:/ilog-api-web/driver/equipages
- Query parameters:
    **-** none
- Returns List<Equipage> of equipages in the user's group
- Example:https://ilog.btf.se/ilog-api-web/driver/equipages

### setStatus (implemented).

- Method:POST
- URL:/ilog-api-web/consignment/setStatus
- Query parameters:
    **- consignmentId** (int) consignmentId
    **- statusTypeId** id (int) of status
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/driver/consignment
    /setStatus?consignmentId=123456789\&statusTypeId=
- Reflections: Driver can change status only for bookings that are connected
    to his/hers equipages

### setEquipage.

- Method:POST
- URL:/ilog-api-web/consignment/setEquipage
- Query parameters:
    **- consignmentId** (int) consignmentId
    **- equipageId** id (int) of equipage
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/driver/consignment
    /setEquipage?consignmentId=123456789\&equipageId=
- OBS! Method will try to send out consignments to PDA (Precom's HD)

### setEquipage for iLog Driver App

- Method:POST
- URL:/ilog-api-web/driver/setEquipage
- Query parameters:
    **- consignmentId** (int) consignmentId
    **- equipageId** id (int) of equipage
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/driver/consignment
    /setEquipage?consignmentId=123456789\&equipageId=


### RollOn.

description: * RollOn - Flänsa på (put booking on equipage using scanned
barcode (waybill) status == LASTAD)

- Method:POST
- URL:/ilog-api-web/consignment/rollOn
- Query parameters:
    **- consignmentId** (int) consignmentId
    **- equipageId** id (int) of equipage, comes from client side (saved in app
       after login)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/rollOn
    ?consignmentId=123456789\&equipageId=
- Reflections: Using equipageId chosen after login by app user gives cer-
    tainty that equipage will be rollOn on the right equipage. RollOn func-
    tion in ilog-mobil doesnt give us that certainty, where we take the first
    equipage from the list that is connected to user.

### RollOff (by consignmentId)

description: * RollOff - Flänsa av (remove booking from equipage)

- Method:POST
- URL:/ilog-api-web/consignment/rollOffById
- Query parameters:
    **- consignmentId** (int) consignmentId
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/rollOf
    fById?consignmentId=

### RollOff (by waybillnumber)

description: * RollOff - Flänsa av (remove booking from equipage)

- Method:POST
- URL:/ilog-api-web/consignment/rollOffByWaybillnumber
- Query parameters:
    **- waybillnumber** (string) waybillnumber
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/rollOf
    fByWaybillnumber?waybillnumber=

### Delivered (implemented).

description: scan barcode (waybill) status == LOSSAD

- Method:POST


- URL:/ilog-api-web/consignment/setDelivered
- Query parameters:
    **- consignmentId** (string) scanned waybillnumber -> (int) consignmen-
       tId (operation on client side)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/consignment/setDel
    ivered?consignmentId=
- Reflections: is it like changing status of consignment, but I want to keep
    those 2 methods separated (one for traﬀicoperator and one for driver)

### Get deviationTypes (implemented).

- Method:GET
- URL:/ilog-api-web/deviation/getTypes
- Returns list of deviationTypes (deviationTypeId, name)
- Example:https://ilog.btf.se/ilog-api-web/deviation/getTypes
- Reflections:

### Get deviations for consignment (implemented)

- Method:GET
- URL:/ilog-api-web/deviation/getDeviations
- Query parameters:
    **- consignmentId** (int) consignmentId
- Returns list of deviations for consignment (id, name)
- Example:https://ilog.btf.se/ilog-api-web/deviation/getDevia
    tions?consignmentId=
- Reflections:

### Add deviation (implemented)

- Method:POST
- URL:/ilog-api-web/deviation/add
- Query parameters:
    **- consignmentId** id (int) of consignment
    **- deviationTypeId** id (int) of deviationTypeId
    **- comment** comment (string)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/deviation/add?cons
    ignmentId=11916029\&deviationTypeId=6\&comment=just\_a\_comm
    ent\_test
- Reflections: We should check if consignment is already invoiced (imple-
    mented)


### Update deviation.

- Method:POST
- URL:/ilog-api-web/deviation/update
- Query parameters:
    **- deviationId** id (int) of deviation
    **- comment** comment (string)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/deviation/update?d
    eviationId=123456\&comment=just\_a\_comment\_test
- Reflections: Only those deviation can be updated that were not yet in-
    voiced! (implemented)

### Remove deviation (implemented)

- Method:POST
- URL:/ilog-api-web/deviation/remove
- Query parameters:
    **- deviationId** id (int) of deviation
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/deviation/remove?d
    eviationId=123456
- Reflections: Only those deviation can be removed that were not yet in-
    voiced! (implemented)

### Get eventypes (implemented)

- Method:GET
- URL:/ilog-api-web/events
- Returns all eventtypes (id, name)
- Example:https://ilog.btf.se/ilog-api-web/events

### Register event.

- Method:POST
- URL:/ilog-api-web/events/register
- Query parameters:
    **- consignmentId** id (int) of consignment
    **- eventCode** (string) of eventcode name
    **- eventReasonCode** (string) of event reason code, not required
    **- text** text (string)
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/events/register?co
    nsignmentId=123456\&eventCode=event\_code\&eventReasonCode=e
    ventReason\_code\&text=just\_a\_comment\_test


### Register event by waybillnumber

- Method:POST
- URL:/ilog-api-web/events/registerByWaybillnumber
- Query parameters:
    **- waybillnumber** waybillnumber (string) of consignment
    **- eventCode** (string) of eventcode name
    **- eventReasonCode** (string) of event reason code, not required
    **- logTime** log time (long) of event in milliseconds, not required, if null
       - sets to now
    **- text** text (string) not required
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/events/registerByW
    aybillnumber?waybillnumber=123456\&eventCode=event\_code\&e
    ventReasonCode=eventReason\_code\&logTime=1541673549478\&tex
    t=just\_a\_comment\_test

TransportInfo's värden för status_event_code:

```
"GR001":~"Avgående",
"GR311":~"Direkthämtat",
"GR191":~"Direktlevererat",
"GR020":~"Ej~levererad",
"GR086":~"Flänsning~av",
"GR087":~"Flänsning~på",
"GR031":~"Hämtat",
"GR104":~"Hämtat~åt~annan~bil",
"GR100":~"In~avisering",
"GR088":~"In~depå",
"GR081":~"In~terminal",
"GR082":~"Kvarlämnat",
"GR112":~"Lastning~avslutad",
"GR110":~"Lastning~påbörjad",
"GR019":~"Levererat",
"GR108":~"Lossning~avslutad",
"GR106":~"Lossning~påbörjad",
"GR005":~"Omex/Ankommande",
"GR291":~"Ruttlevererat",
"GR092":~"Till~depå",
"GR018":~"Utlastat",
"GR181":~"Utlastat~ej~LF",
"GR091":~"Utlastning~från~depå",
"GR232":~"Leveranskvittens~lagrad",
"GR555":~"Skrymme"
event_reason_codes:
"72":~"Ej~lastat"
```

"31":~"Fel~Adress"~
"39":~"Fellastat"
"71":~"Försenad"
"40":~"Hittar~ej~mottagare"
"34":~"Portkod"
"36":~"Stängt"
"79":~"Sändning~saknas"
"33":~"Vägrar~ta~emot"

### Update consignment paramters

- Method:POST
- URL:/ilog-api-web/driver/updateConsignment
- Query parameters: JSON format
- Parameters:

id~(consignemntId)~required~to~find~right~consignment
weight,~kolli,~volume~(double),~halfpall,~pall,~pallplaces~(doub
le),~flakmeters(double),~length(double),~width(double),~height(do
uble)

If~parameter~not~present,~value~will~be~set~to~null.~~

- Returns success with updated consignment
- Example:https://ilog.btf.se/ilog-api-web/driver/updateConsi
    gnments
- Post data:

\{
~"id":~28976809,
~"weight":~1,
~"kolli":~2,
~"volume":~3,
~"halfpall":~4,
~"pall":~5,
~"pallplaces":~6,
~"flakmeters":~7,
~"length":~8,
~"width":~9,
~"height":~10
\}

### Update comments in consignment

- Method:POST
- URL:/ilog-api-web/driver/updateConsignmentComments
- Query parameters:


**- consignemntId** (int) consignmentId, required
**- comment** (string) comment, not required
**- internComment** (string) intern comment, not required
- Returns success with updated consignment
- Example:https://ilog.btf.se/ilog-api-web/driver/updateConsi
gnmentComments?consignmentId=123456\&comment=test\&internCom
ment=internComment

### Add equipage cleaning log.

- Method:POST
- URL:/ilog-api-web/driver/addEquipageCleaningLog
- Query parameters:
    **- equipageId** (int) equipageId, required
    **- status** cleaningStatus, required (CLEANED, NOT_CLEANED,
       IMPOSSIBLE_TO_CONTROL, NONE)
    **- logTime** Unix Timestamp with milliseconds, not required, if not
       specified - now()
    **- comment** (string) comment, not required
- Returns success
- Example:https://ilog.btf.se/ilog-api-web/driver/addEquipage
    CleaningLog?equipageId=1\&status=CLEANED\&comment=test

### Set positioning in consignment

- Method:POST
- URL:/ilog-api-web/driver/setPositioning
- Query parameters:
    **- consignemntId** (int) consignmentId, required
    **- positioning** (string) positioning, required
- Returns success with updated consignment
- Example:https://ilog.btf.se/ilog-api-web/driver/setPosition
    ing?consignmentId=123456\&positioning=B1B2

### Set pickupDate in consignment

- Method:POST
- URL:/ilog-api-web/driver/setPickupDate
- Query parameters:
    **- consignemntId** (int) consignmentId, required
    **- pickupDate** (string) pickupDate, required
- Returns success with updated consignment
- Example:https://ilog.btf.se/ilog-api-web/driver/setPickupDa
    te?consignmentId=123456\&pickupDate=20191031


### Set missReason in consignment

- Method:POST
- URL:/ilog-api-web/driver/setMissReason
- Query parameters:
    **- consignemntId** (int) consignmentId, required
    **- missReason** (string) missReason, required
- Returns success with updated consignment
- Example:https://ilog.btf.se/ilog-api-web/driver/setMissReas
    on?consignmentId=123456\&missReason=CLOSED

## Chat functions

Work in progress. EDT 4.28

### getThreads

- Method:GET
- URL:/ilog-api-web/chat/threads
- Query parameters:
    **-** None
- Returns List<ChatMessageThread> all recent chat threads
- Example:https://ilog.btf.se/ilog-api-web/chat/threads

### getThread.

- Method:GET
- URL:/ilog-api-web/chat/thread
- Query parameters:
    **- uuid** uuid of chat thread
- Returns ChatMessageThread chat thread
- Example:https://ilog.btf.se/ilog-api-web/chat/thread?uuid=d
    33aab5a-0ee4-4e19-9b83-f2b96d4dac7d

### requestConsignmentAction

- Method:GET
- URL:/ilog-api-web/chat/requestaction
- Query parameters:
    **- consignmentId** id of the consignment
    **- requestAction** action required
~~~CONSIGNMENT\_REQUEST\_COLLECTION
~~~CONSIGNMENT\_REQUEST\_OMEX
~~~CONSIGNMENT\_REQUEST\_MOVE\_PICKUPDATE~/*One~transport~day*/


~~~CONSIGNMENT\_REQUEST\_PICKUPDATE\_CHANGED~/*Date~specified~i
n~the~message*/

- Returns ChatMessageThread chat thread
- Example:https://ilog.btf.se/ilog-api-web/chat/requestaction
    ?consignmentId=12345678\&requestAction=CONSIGNMENT\_REQUEST\
    _COLLECTION

Category:ILogCategory:ILog


