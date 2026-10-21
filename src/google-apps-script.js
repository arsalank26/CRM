/**
 * ============================================================================
 * AL UZER COMMON SERVICES - GOOGLE APPS SCRIPT WEB APP
 * ============================================================================
 * 
 * HOW TO SET UP THIS GOOGLE APPS SCRIPT:
 * 1. Open your Google Spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4/edit
 * 2. In the top menu, click: Extensions -> Apps Script.
 * 3. Delete all code currently in the editor and PASTE this entire script.
 * 4. Click the "Save project" (Floppy disk icon) or press Ctrl+S.
 * 5. Click the blue "Deploy" button (top right) -> "Manage deployments" -> edit icon (pencil)
 *    -> Version: "New version" -> Deploy.
 *    (OR click "New deployment" -> type: Web app -> Execute as: Me -> Access: Anyone -> Deploy)
 * 6. That's it! Your single-page layout (Customers + Spendings + Kirkol) is now active.
 * ============================================================================
 */

var DEFAULT_SPREADSHEET_ID = '1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4';

var MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getSpreadsheet(data) {
  var id = (data && (data.spreadsheetId || data.id)) || DEFAULT_SPREADSHEET_ID;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) return ss;
  } catch (e) { }

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) { }
  }
  return null;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';
  var ss = getSpreadsheet(e ? e.parameter : null);

  if (action === 'status') {
    if (!ss) {
      return createJsonResponse({
        success: false,
        error: 'Could not access spreadsheet. Please check Spreadsheet ID: ' + DEFAULT_SPREADSHEET_ID
      });
    }
    return createJsonResponse({
      success: true,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      sheets: ss.getSheets().map(function (s) { return s.getName(); }),
      message: 'Google Apps Script Web App is connected and active!'
    });
  }

  return createJsonResponse({ success: true, message: 'Al Uzer CRM Web App API is running.' });
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = data.action || 'sync_all';
    var ss = getSpreadsheet(data);

    if (!ss) {
      return createJsonResponse({
        success: false,
        error: 'Unable to open target spreadsheet (ID: ' + DEFAULT_SPREADSHEET_ID + ').'
      });
    }

    switch (action) {
      case 'get_status':
        return createJsonResponse({
          success: true,
          spreadsheetName: ss.getName(),
          spreadsheetUrl: ss.getUrl(),
          spreadsheetId: ss.getId(),
          sheets: ss.getSheets().map(function (s) { return s.getName(); })
        });

      case 'create_month_sheet':
        return handleCreateMonthSheet(ss, data);

      case 'create_year_workspace':
        return handleCreateYearWorkspace(data);

      case 'sync_all':
        return handleSyncAll(ss, data);

      case 'save_customer':
        return handleSaveCustomer(ss, data);

      case 'save_spending':
        return handleSaveSpending(ss, data);

      case 'save_kirkol':
        return handleSaveKirkol(ss, data);

      default:
        return createJsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString(), stack: err.stack });
  }
}

/**
 * Creates or updates a formatted sheet for a specific Month (e.g., "September 2026")
 * with Customers, Spendings, and Kirkol on that single sheet page.
 */
function handleCreateMonthSheet(ss, data) {
  var monthName = data.monthName || 'September';
  var year = data.year || new Date().getFullYear();
  var sheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Populate sheet with any provided records or fresh formatted template
  renderFullMonthSheet(
    sheet,
    sheetName,
    data.customers || [],
    data.spendings || [],
    data.kirkol || [],
    data.totals || {}
  );

  return createJsonResponse({
    success: true,
    sheetName: sheetName,
    spreadsheetUrl: ss.getUrl(),
    message: 'Month sheet "' + sheetName + '" created with Customer, Spending, and Kirkol on a single page!'
  });
}

/**
 * Creates a brand new Google Spreadsheet for a new Year with all 12 months pre-built!
 */
function handleCreateYearWorkspace(data) {
  var year = Number(data.year) || (new Date().getFullYear() + 1);
  var workspaceName = 'Al Uzer CRM - ' + year + ' Workspace';

  var newSS = SpreadsheetApp.create(workspaceName);

  // Create Annual Overview tab
  var overviewSheet = newSS.getActiveSheet();
  overviewSheet.setName('Annual Overview');
  formatAnnualOverviewSheet(overviewSheet, year, MONTHS);

  // Create 12 monthly sheets with all 3 tables on each single page
  for (var i = 0; i < MONTHS.length; i++) {
    var monthSheet = newSS.insertSheet(MONTHS[i] + ' ' + year);
    renderFullMonthSheet(monthSheet, MONTHS[i] + ' ' + year, [], [], [], {});
  }

  return createJsonResponse({
    success: true,
    year: year,
    spreadsheetId: newSS.getId(),
    spreadsheetUrl: newSS.getUrl(),
    spreadsheetName: workspaceName,
    message: 'New Year Workspace "' + workspaceName + '" created with 12 formatted single-page month sheets!'
  });
}

/**
 * Syncs full month data payload (Customers, Spendings, Kirkol, Totals) to Google Sheets
 */
function handleSyncAll(ss, data) {
  var monthName = data.monthName || 'September';
  var year = data.year || new Date().getFullYear();
  var customers = data.customers || [];
  var spendings = data.spendings || [];
  var kirkol = data.kirkol || [];
  var totals = data.totals || {};

  var targetSheetName = data.isMonthly ? (monthName + ' ' + year) : (monthName + ' ' + year);
  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
  }

  renderFullMonthSheet(sheet, targetSheetName, customers, spendings, kirkol, totals);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    customersCount: customers.length,
    spendingsCount: spendings.length,
    kirkolCount: kirkol.length,
    spreadsheetUrl: ss.getUrl(),
    message: 'Data successfully synced to ' + targetSheetName + ' on a single page!'
  });
}

/**
 * Saves a new customer record directly into that month's sheet table
 * (NO separate "Customer Records" sheet!)
 */
function handleSaveCustomer(ss, data) {
  var c = data.customer || data;
  var d = c.created_at ? new Date(c.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  // If full month array is passed, perform complete clean sync
  if (data.customers && data.customers.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers, data.spendings || [], data.kirkol || [], data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  // Otherwise insert single customer into CUSTOMER WORK table
  insertCustomerIntoMonthSheet(sheet, c);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Customer added to ' + targetSheetName + ' sheet'
  });
}

/**
 * Saves a spending record directly into that month's sheet table
 * (NO separate "Spendings" sheet!)
 */
function handleSaveSpending(ss, data) {
  var s = data.spending || data;
  var d = s.created_at ? new Date(s.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  if (data.spendings && data.spendings.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers || [], data.spendings, data.kirkol || [], data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  insertSpendingIntoMonthSheet(sheet, s);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Spending added to ' + targetSheetName + ' sheet'
  });
}

/**
 * Saves a kirkol record directly into that month's sheet table
 * (NO separate "Kirkol" sheet!)
 */
function handleSaveKirkol(ss, data) {
  var k = data.kirkol || data;
  var d = k.created_at ? new Date(k.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  if (data.kirkol && data.kirkol.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers || [], data.spendings || [], data.kirkol, data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  insertKirkolIntoMonthSheet(sheet, k);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Kirkol added to ' + targetSheetName + ' sheet'
  });
}

/**
 * Main Layout Renderer: Renders Customers, Spendings, and Kirkol on a SINGLE page.
 */
function renderFullMonthSheet(sheet, sheetTitle, customers, spendings, kirkol, totals) {
  customers = customers || [];
  spendings = spendings || [];
  kirkol = kirkol || [];
  totals = totals || {};

  sheet.clear();

  // 1. Title Header Banner
  sheet.getRange('A1:L1').merge();
  var titleCell = sheet.getRange('A1');
  titleCell.setValue('AL UZER COMMON SERVICES - ' + sheetTitle.toUpperCase());
  titleCell.setFontSize(14).setFontWeight('bold').setBackground('#18382b').setFontColor('#ffffff').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 40);

  // Compute values
  var custTotal = 0, custPaid = 0, custBalance = 0, custExpense = 0, custIncome = 0;
  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    var tot = Number(c.total_amount) || 0;
    var pd = Number(c.paid) || 0;
    var exp = Number(c.expense) || 0;
    custTotal += tot;
    custPaid += pd;
    custBalance += (tot - pd);
    custIncome += (tot - exp);
  }

  var spendTotal = 0;
  for (var j = 0; j < spendings.length; j++) {
    spendTotal += (Number(spendings[j].amount) || 0);
  }

  var kirkolTotal = 0;
  for (var k = 0; k < kirkol.length; k++) {
    kirkolTotal += (Number(kirkol[k].price) || 0);
  }

  var finalTotalAmount = totals.totalAmount != null ? totals.totalAmount : custTotal;
  var finalCollected = totals.collectedAmount != null ? totals.collectedAmount : custPaid;
  var finalPending = totals.pendingAmount != null ? totals.pendingAmount : custBalance;
  var finalIncome = totals.totalIncome != null ? totals.totalIncome : (custIncome + kirkolTotal);
  var finalSpending = totals.totalSpending != null ? totals.totalSpending : spendTotal;
  var remainingVal = finalIncome - finalSpending;

  // 2. KPI Summary Cards block in Row 3-4
  sheet.getRange('A3:B3').merge().setValue('Total Jobs / Records').setFontWeight('bold').setBackground('#f0f5f2');
  sheet.getRange('A4:B4').merge().setValue(customers.length).setFontSize(13).setFontWeight('bold');

  sheet.getRange('C3:D3').merge().setValue('Sum of Total Amount').setFontWeight('bold').setBackground('#f0f5f2');
  sheet.getRange('C4:D4').merge().setValue(finalTotalAmount).setFontSize(13).setFontWeight('bold').setNumberFormat('₹#,##0');

  sheet.getRange('E3:F3').merge().setValue('Collected Amount').setFontWeight('bold').setBackground('#e7f5ed');
  sheet.getRange('E4:F4').merge().setValue(finalCollected).setFontSize(13).setFontWeight('bold').setFontColor('#167c57').setNumberFormat('₹#,##0');

  sheet.getRange('G3:H3').merge().setValue('Pending Amount').setFontWeight('bold').setBackground('#fff0ea');
  sheet.getRange('G4:H4').merge().setValue(finalPending).setFontSize(13).setFontWeight('bold').setFontColor('#c46143').setNumberFormat('₹#,##0');

  sheet.getRange('I3:J3').merge().setValue('Total Income (Profit)').setFontWeight('bold').setBackground('#e6f5ee');
  sheet.getRange('I4:J4').merge().setValue(finalIncome).setFontSize(13).setFontWeight('bold').setFontColor('#167c57').setNumberFormat('₹#,##0');

  sheet.getRange('K3:L3').merge().setValue('Total Spending').setFontWeight('bold').setBackground('#fff3dd');
  sheet.getRange('K4:L4').merge().setValue(finalSpending).setFontSize(13).setFontWeight('bold').setFontColor('#b27a29').setNumberFormat('₹#,##0');

  // 3. Remaining Amount Banner
  sheet.getRange('A6:L6').merge();
  var remainingCell = sheet.getRange('A6');
  remainingCell.setValue('★ REMAINING AMOUNT (Total Income - Total Spending): ' + formatInr(remainingVal));
  remainingCell.setFontSize(12).setFontWeight('bold').setBackground('#d8f2e3').setFontColor('#105a3e').setHorizontalAlignment('center');
  sheet.setRowHeight(6, 32);

  // 4. Section 1: Customer Work & Transactions Table
  sheet.getRange('A8').setValue('CUSTOMER WORK & TRANSACTIONS').setFontSize(11).setFontWeight('bold').setFontColor('#18382b');
  var custHeaders = ['#', 'Date', 'Customer Name', 'Mobile', 'Work Type', 'Work Status', 'Total Amount (₹)', 'Paid (₹)', 'Balance (₹)', 'Expense (₹)', 'Income (₹)', 'Payment Status'];
  sheet.getRange(9, 1, 1, custHeaders.length).setValues([custHeaders])
    .setFontWeight('bold').setBackground('#167c57').setFontColor('#ffffff');

  var startRow = 10;
  if (customers.length > 0) {
    var custRows = customers.map(function (c, idx) {
      var tot = Number(c.total_amount) || 0;
      var pd = Number(c.paid) || 0;
      var exp = Number(c.expense) || 0;
      var bal = tot - pd;
      var inc = tot - exp;
      return [
        idx + 1,
        formatDateStr(c.created_at),
        c.customer_name || '',
        c.mobile || '',
        c.work_type || '',
        c.work_status || '',
        tot,
        pd,
        bal,
        exp,
        inc,
        c.payment_status || ''
      ];
    });
    sheet.getRange(startRow, 1, custRows.length, custHeaders.length).setValues(custRows);
    sheet.getRange(startRow, 7, custRows.length, 5).setNumberFormat('₹#,##0');
    startRow += custRows.length;
  } else {
    sheet.getRange(startRow, 1, 1, custHeaders.length).merge().setValue('No customer records found.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
    startRow += 1;
  }

  // 5. Section 2: Business Spendings
  startRow += 2;
  sheet.getRange(startRow, 1).setValue('BUSINESS SPENDINGS').setFontSize(11).setFontWeight('bold').setFontColor('#b27a29');
  startRow += 1;
  var spendHeaders = ['#', 'Date', 'Expense Name', 'Category', 'Amount (₹)'];
  sheet.getRange(startRow, 1, 1, spendHeaders.length).setValues([spendHeaders])
    .setFontWeight('bold').setBackground('#c78329').setFontColor('#ffffff');
  startRow += 1;

  if (spendings.length > 0) {
    var spendRows = spendings.map(function (s, idx) {
      return [
        idx + 1,
        formatDateStr(s.created_at),
        s.expense_name || '',
        s.category || '',
        Number(s.amount) || 0
      ];
    });
    sheet.getRange(startRow, 1, spendRows.length, spendHeaders.length).setValues(spendRows);
    sheet.getRange(startRow, 5, spendRows.length, 1).setNumberFormat('₹#,##0');
    startRow += spendRows.length;
  } else {
    sheet.getRange(startRow, 1, 1, spendHeaders.length).merge().setValue('No spending recorded.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
    startRow += 1;
  }

  // 6. Section 3: Kirkol (Misc Work)
  startRow += 2;
  sheet.getRange(startRow, 1).setValue('KIRKOL (MISC WORK)').setFontSize(11).setFontWeight('bold').setFontColor('#e8753a');
  startRow += 1;
  var kirkolHeaders = ['#', 'Date', 'Work Description', 'Price (₹)'];
  sheet.getRange(startRow, 1, 1, kirkolHeaders.length).setValues([kirkolHeaders])
    .setFontWeight('bold').setBackground('#ff9a56').setFontColor('#ffffff');
  startRow += 1;

  if (kirkol.length > 0) {
    var kirkolRows = kirkol.map(function (k, idx) {
      return [
        idx + 1,
        formatDateStr(k.created_at),
        k.work || '',
        Number(k.price) || 0
      ];
    });
    sheet.getRange(startRow, 1, kirkolRows.length, kirkolHeaders.length).setValues(kirkolRows);
    sheet.getRange(startRow, 4, kirkolRows.length, 1).setNumberFormat('₹#,##0');
  } else {
    sheet.getRange(startRow, 1, 1, kirkolHeaders.length).merge().setValue('No kirkol recorded.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
  }

  // Auto-resize columns
  for (var col = 1; col <= 12; col++) {
    sheet.autoResizeColumn(col);
  }
}

function findRowWithText(sheet, text) {
  var maxRows = Math.min(sheet.getLastRow() + 5, 200);
  if (maxRows <= 0) return -1;
  var values = sheet.getRange(1, 1, maxRows, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === text.trim().toUpperCase()) {
      return i + 1;
    }
  }
  return -1;
}

function insertCustomerIntoMonthSheet(sheet, c) {
  var spendRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
  if (spendRow === -1) {
    renderFullMonthSheet(sheet, sheet.getName(), [c], [], [], {});
    return;
  }

  var cellA10 = String(sheet.getRange(10, 1).getValue()).trim();
  if (cellA10 === 'No customer records found.' || sheet.getRange(10, 1).isPartOfMerge()) {
    try {
      sheet.getRange(10, 1, 1, 12).breakApart();
    } catch (e) { }
    var tot = Number(c.total_amount) || 0;
    var pd = Number(c.paid) || 0;
    var exp = Number(c.expense) || 0;
    sheet.getRange(10, 1, 1, 12).setValues([[
      1,
      formatDateStr(c.created_at),
      c.customer_name || '',
      c.mobile || '',
      c.work_type || '',
      c.work_status || '',
      tot,
      pd,
      tot - pd,
      exp,
      tot - exp,
      c.payment_status || ''
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(10, 7, 1, 5).setNumberFormat('₹#,##0');
    return;
  }

  var insertAt = Math.max(10, spendRow - 1);
  sheet.insertRowBefore(insertAt);

  var tot = Number(c.total_amount) || 0;
  var pd = Number(c.paid) || 0;
  var exp = Number(c.expense) || 0;
  var newIdx = insertAt - 9;

  sheet.getRange(insertAt, 1, 1, 12).setValues([[
    newIdx,
    formatDateStr(c.created_at),
    c.customer_name || '',
    c.mobile || '',
    c.work_type || '',
    c.work_status || '',
    tot,
    pd,
    tot - pd,
    exp,
    tot - exp,
    c.payment_status || ''
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(insertAt, 7, 1, 5).setNumberFormat('₹#,##0');
}

function insertSpendingIntoMonthSheet(sheet, s) {
  var kirkolRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
  var spendTitleRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
  if (spendTitleRow === -1 || kirkolRow === -1) return;

  var firstSpendRow = spendTitleRow + 2;
  var firstCell = String(sheet.getRange(firstSpendRow, 1).getValue()).trim();
  if (firstCell === 'No spending recorded.' || sheet.getRange(firstSpendRow, 1).isPartOfMerge()) {
    try {
      sheet.getRange(firstSpendRow, 1, 1, 5).breakApart();
    } catch (e) { }
    sheet.getRange(firstSpendRow, 1, 1, 5).setValues([[
      1,
      formatDateStr(s.created_at),
      s.expense_name || '',
      s.category || '',
      Number(s.amount) || 0
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(firstSpendRow, 5, 1, 1).setNumberFormat('₹#,##0');
    return;
  }

  var insertAt = Math.max(firstSpendRow, kirkolRow - 1);
  sheet.insertRowBefore(insertAt);
  var newIdx = insertAt - (spendTitleRow + 1);
  sheet.getRange(insertAt, 1, 1, 5).setValues([[
    newIdx,
    formatDateStr(s.created_at),
    s.expense_name || '',
    s.category || '',
    Number(s.amount) || 0
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(insertAt, 5, 1, 1).setNumberFormat('₹#,##0');
}

function insertKirkolIntoMonthSheet(sheet, k) {
  var kirkolTitleRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
  if (kirkolTitleRow === -1) return;

  var firstKirkolRow = kirkolTitleRow + 2;
  var firstCell = String(sheet.getRange(firstKirkolRow, 1).getValue()).trim();
  if (firstCell === 'No kirkol recorded.' || sheet.getRange(firstKirkolRow, 1).isPartOfMerge()) {
    try {
      sheet.getRange(firstKirkolRow, 1, 1, 4).breakApart();
    } catch (e) { }
    sheet.getRange(firstKirkolRow, 1, 1, 4).setValues([[
      1,
      formatDateStr(k.created_at),
      k.work || '',
      Number(k.price) || 0
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(firstKirkolRow, 4, 1, 1).setNumberFormat('₹#,##0');
    return;
  }

  var lastRow = sheet.getLastRow();
  var newIdx = (lastRow - (kirkolTitleRow + 1)) + 1;
  sheet.getRange(lastRow + 1, 1, 1, 4).setValues([[
    newIdx,
    formatDateStr(k.created_at),
    k.work || '',
    Number(k.price) || 0
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(lastRow + 1, 4, 1, 1).setNumberFormat('₹#,##0');
}

function recalculateSheetTotals(sheet) {
  try {
    var spendRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
    var kirkolRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
    if (spendRow === -1 || kirkolRow === -1) return;

    var custCount = 0, totAmount = 0, collected = 0, pending = 0, custIncome = 0;
    var lastCustRow = spendRow - 2;
    if (lastCustRow >= 10) {
      var firstCell = String(sheet.getRange(10, 1).getValue()).trim();
      if (firstCell !== 'No customer records found.') {
        var numRows = (lastCustRow - 10) + 1;
        var custData = sheet.getRange(10, 7, numRows, 5).getValues();
        custCount = numRows;
        for (var i = 0; i < custData.length; i++) {
          totAmount += (Number(custData[i][0]) || 0);
          collected += (Number(custData[i][1]) || 0);
          pending += (Number(custData[i][2]) || 0);
          custIncome += (Number(custData[i][4]) || 0);
        }
      }
    }

    var totalSpending = 0;
    var lastSpendRow = kirkolRow - 2;
    var firstSpendRow = spendRow + 2;
    if (lastSpendRow >= firstSpendRow) {
      var firstSpendCell = String(sheet.getRange(firstSpendRow, 1).getValue()).trim();
      if (firstSpendCell !== 'No spending recorded.') {
        var numSpendRows = (lastSpendRow - firstSpendRow) + 1;
        var spendData = sheet.getRange(firstSpendRow, 5, numSpendRows, 1).getValues();
        for (var j = 0; j < spendData.length; j++) {
          totalSpending += (Number(spendData[j][0]) || 0);
        }
      }
    }

    var totalKirkol = 0;
    var firstKirkolRow = kirkolRow + 2;
    var lastKirkolRow = sheet.getLastRow();
    if (lastKirkolRow >= firstKirkolRow) {
      var firstKirkolCell = String(sheet.getRange(firstKirkolRow, 1).getValue()).trim();
      if (firstKirkolCell !== 'No kirkol recorded.') {
        var numKirkolRows = (lastKirkolRow - firstKirkolRow) + 1;
        var kirkolData = sheet.getRange(firstKirkolRow, 4, numKirkolRows, 1).getValues();
        for (var k = 0; k < kirkolData.length; k++) {
          totalKirkol += (Number(kirkolData[k][0]) || 0);
        }
      }
    }

    var totalIncome = custIncome + totalKirkol;
    var remaining = totalIncome - totalSpending;

    sheet.getRange('A4:B4').setValue(custCount);
    sheet.getRange('C4:D4').setValue(totAmount);
    sheet.getRange('E4:F4').setValue(collected);
    sheet.getRange('G4:H4').setValue(pending);
    sheet.getRange('I4:J4').setValue(totalIncome);
    sheet.getRange('K4:L4').setValue(totalSpending);
    sheet.getRange('A6').setValue('★ REMAINING AMOUNT (Total Income - Total Spending): ' + formatInr(remaining));
  } catch (e) { }
}

function formatAnnualOverviewSheet(sheet, year, months) {
  sheet.clear();
  sheet.getRange('A1:G1').merge();
  sheet.getRange('A1').setValue('AL UZER SERVICES - ANNUAL OVERVIEW ' + year)
    .setFontSize(15).setFontWeight('bold').setBackground('#18382b').setFontColor('#ffffff').setHorizontalAlignment('center');

  var headers = ['Month', 'Total Jobs', 'Total Revenue (₹)', 'Collected (₹)', 'Total Income (₹)', 'Total Spending (₹)', 'Remaining Amount (₹)'];
  sheet.getRange('A3:G3').setValues([headers]).setFontWeight('bold').setBackground('#167c57').setFontColor('#ffffff');

  var rows = months.map(function (m) {
    return [m + ' ' + year, 0, 0, 0, 0, 0, 0];
  });
  sheet.getRange(4, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(4, 3, rows.length, 5).setNumberFormat('₹#,##0');
}

function formatDateStr(isoStr) {
  if (!isoStr) return '';
  try {
    var d = new Date(isoStr);
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+05:30', 'yyyy-MM-dd');
  } catch (e) {
    return String(isoStr).substring(0, 10);
  }
}

function formatInr(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
