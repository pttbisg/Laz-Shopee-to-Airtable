/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

const API_KEY = "keyDnSRU2wOpLfkac"; //keyDKgRUhZqLlp7Mk
const BASE = "appEDnb5sNTRGWHoV"; //appfmhpqL53IXwBzk
const TABLE_NAME = "Lazada Orders";
const FILENAME = "LAZ.xlsx";
const FAILED_FILE_NAME = "failed.csv";
const ID_COLUMN = "orderNumber";
const itemID_COLUMN = "orderItemId";

const fs = require("fs");
const Airtable = require("airtable");
const XLSX = require("xlsx");

Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: API_KEY,
});
const base = Airtable.base(BASE);

const getRecordsFromAirtable = async () => {
  const allRecords = [];

  await base(TABLE_NAME)
    .select({
      view: "Grid view",
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        allRecords.push(record._rawJson);
      });

      fetchNextPage();
    });

  return allRecords;
};

const getRecordsFromFile = () => {
  const workbook = XLSX.readFile(FILENAME);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonSheet = XLSX.utils.sheet_to_json(sheet);
  console.log("JSON SHEET: " & jsonSheet);
  return jsonSheet;
};

const createAirtableRecords = async (records) => {
  const failedRecords = [];
  for (const record of records) {
    try {
      await base(TABLE_NAME).create([record], { typecast: true });
    } catch (e) {
      failedRecords.push(record.fields);
      console.log("update error", e);
    }
  }

  return failedRecords;
};

const updateAirtableRecords = async (records) => {
  const failedRecords = [];
  for (const record of records) {
    try {
      await base(TABLE_NAME).update([record], { typecast: true });
    } catch (e) {
      failedRecords.push(record.fields);
      console.log("update error", e);
    }
  }

  return failedRecords;
};

const compareRecords = (fileFields, airtableFields) => {
  /*  let conditionsArray = [condition1, condition2, condition3];

  if (conditionsArray.indexOf(false) === -1) {
    "do somthing"
}
Or ES7+

if (!conditionsArray.includes(false)) {
   "do somthing"
} 

*/
  const isExist =
    fileFields[ID_COLUMN] == airtableFields[ID_COLUMN] &&
    fileFields[itemID_COLUMN] == airtableFields[itemID_COLUMN];
  console.log(isExist);
  return isExist;
};

(async function exec() {
  try {
    const toCreate = [];
    const toUpdate = [];

    const fileRecords = getRecordsFromFile();
    const airtableRecords = await getRecordsFromAirtable();

    fileRecords.forEach((fileRecord) => {
      const existingRecord = airtableRecords.find((airtableRecord) => {
        const isExist = compareRecords(fileRecord, airtableRecord.fields);
        return isExist;
      });

      if (existingRecord) {
        toUpdate.push({
          id: existingRecord.id,
          fields: fileRecord,
        });
      } else {
        toCreate.push({
          fields: fileRecord,
        });
      }
    });

    const failedUpdateRecords = await updateAirtableRecords(toUpdate);
    const failedCreateRecords = await createAirtableRecords(toCreate);
    const failedRecords = [...failedCreateRecords, ...failedUpdateRecords];
    const failedSheet = XLSX.utils.json_to_sheet(failedRecords);
    const stream = XLSX.stream.to_csv(failedSheet);
    stream.pipe(fs.createWriteStream(FAILED_FILE_NAME));
    console.log("TO UPDATE: " & JSON.stringify(toUpdate));
    console.log("TO CREATE: " & JSON.stringify(toCreate));
  } catch (e) {
    console.error("exec error", e);
  }
})();
