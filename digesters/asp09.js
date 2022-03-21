/*
  asp09
  Creator of a query for asp09.html.
*/
exports.parameters = (report, query) => {
  // Makes strings HTML-safe.
  const htmlEscape = textOrNumber => textOrNumber
  .toString()
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;');
  // Newlines with indentations.
  const joiner = '\n      ';
  const innerJoiner = '\n        ';
  // Creates messages about results of packaged tests.
  const packageSucceedText = package =>
    `<p>The page <strong>passed</strong> the <code>${package}</code> test.</p>`;
  const packageFailText = (score, package, failures) =>
    `<p>The page <strong>did not pass</strong> the <code>${package}</code> test and received a score of ${score} on <code>${package}</code>. The details are in the <a href="../jsonReports/${fn}">JSON-format file</a>, in the section starting with <code>"which": "${package}"</code>. There was at least one failure of:</p>${joiner}<ul>${innerJoiner}${failures}${joiner}</ul>`;
  // Creates messages about results of custom tests.
  const customSucceedText =
    test => `<p>The page <strong>passed</strong> the <code>${test}</code> test.</p>`;
  const customFailText = (score, test) =>
    `<p>The page <strong>did not pass</strong> the <code>${test}</code> test and received a score of ${score} on <code>${test}</code>. The details are in the <a href="../jsonReports/${fn}">JSON-format file</a>, in the section starting with <code>"which": "${test}"</code>.</p>`;
  const testCrashText = (score, test) => `<p>The <code>${test}</code> test could not be performed. The page received an inferred score of ${score} on <code>${test}</code>.</p>`;
  const customFailures = failObj => Object
  .entries(failObj)
  .map(entry => `<li>${entry[0]}: ${entry[1]}</li>`)
  .join(innerJoiner);
  const customFailMore = failures =>
    `<p>Summary of the details:</p>${joiner}<ul>${innerJoiner}${failures}${joiner}</ul>`;
  const customResult = (score, test, failures) =>
    `${customFailText(score, test)}${joiner}${customFailMore(failures)}`;
  // Get general data.
  query.dateISO = report.endTime.slice(0, 10);
  query.dateSlash = query.dateISO.replace(/-/g, '/');
  query.reportID = report.id;
  query.scoreProc = __filename.slice(0, -3);
  query.org = report.host.what;
  query.url = report.host.which;
  const {deficit} = scoreData;
  query.totalScore = deficit.total;
  // Get summary-table data for scoreDoc.
  const deficitData = Object.assign({}, deficit, scoreData.inferences);
  const deficitTypes = Object.keys(deficitData);
  query.deficitRows = deficitTypes
  .sort((a, b) => deficitData[b] - deficitData[a])
  .map(type => `<tr><th>${type}</th><td>${deficitData[type]}</td></tr>`)
  .join(innerJoiner);
  query.scoreTable = JSON.stringify(scoreData.deficit, null, 2).replace(/^\{\n|[}","]/g, '');
  // Get package-test result messages for scoreDoc.
  // aatt
  if (deficit.aatt) {
    const aattWarnings = new Set(testData.aatt.result.filter(item => item.type === 'warning')
    .map(item => `warning: ${item.msg}`));
    const aattErrors = new Set(testData.aatt.result.filter(item => item.type === 'error')
    .map(item => `error: ${item.msg}`));
    const aattBoth = Array.from(aattWarnings).concat(Array.from(aattErrors));
    const aattFailures = aattBoth.map(item => `<li>${htmlEscape(item)}</li>`).join(innerJoiner);
    query.aattResult = packageFailText(deficit.aatt, 'aatt', aattFailures);
  }
  else if (scoreData.inferences.aatt) {
    query.aattResult = testCrashText(deficitData.aatt, 'aatt');
  }
  else {
    query.aattResult = packageSucceedText('aatt');
  }
  // axe
  if (deficit.axe) {
    const axeFailures = testData.axe.result.items.map(
      item => `<li>${item.rule}: ${htmlEscape(item.description)}</li>`
    ).join(innerJoiner);
    query.axeResult = packageFailText(deficit.axe, 'axe', axeFailures);
  }
  else if (scoreData.inferences.axe) {
    query.axeResult = testCrashText(deficitData.axe, 'axe');
  }
  else {
    query.axeResult = packageSucceedText('axe');
  }
  // ibm
  if (deficit.ibm) {
    const {result} = testData.ibm;
    const contentItems = result.content.items;
    const urlItems = result.url.items;
    const items = [];
    if (contentItems) {
      items.push(...contentItems);
    }
    if (urlItems) {
      items.push(...urlItems);
    }
    const ibmFailures = Array.from(new Set(items.map(
      item => `<li>${item.ruleId}: ${htmlEscape(item.message)}</li>`
    )).values()).join(innerJoiner);
    query.ibmResult = packageFailText(deficit.ibm, 'ibm', ibmFailures);
  }
  else if (scoreData.inferences.ibm) {
    query.ibmResult = testCrashText(deficitData.ibm, 'ibm');
  }
  else {
    query.ibmResult = packageSucceedText('ibm');
  }
  // wave
  if (deficit.wave) {
    const waveResult = testData.wave.result.categories;
    const waveItems = [];
    ['error', 'contrast', 'alert'].forEach(category => {
      waveItems.push(
        ... Object
        .entries(waveResult[category].items)
        .map(entry => `<li>${category}/${entry[0]}: ${entry[1].description}</li>`)
      );
    });
    const waveFailures = waveItems.join(innerJoiner);
    query.waveResult = packageFailText(deficit.wave, 'wave', waveFailures);
  }
  else if (scoreData.inferences.wave) {
    query.waveResult = testCrashText(deficitData.wave, 'wave');
  }
  else {
    query.waveResult = packageSucceedText('wave');
  }
  // Get custom-test result messages for scoreDoc.
  if (deficit.bulk) {
    query.bulkResult = `The page <strong>did not pass</strong> the <code>bulk</code> test. The count of visible elements in the page was ${testData.bulk.result.visibleElements}, resulting in a score of ${deficit.bulk} on <code>bulk</code>.`;
  }
  else if (scoreData.inferences.bulk) {
    query.bulkResult = testCrashText(deficitData.bulk, 'bulk');
  }
  else {
    query.bulkResult = customSucceedText('bulk');
  }
  if (deficit.embAc) {
    const failures = customFailures(testData.embAc.result.totals);
    query.embAcResult = customResult(deficit.embAc, 'embAc', failures);
  }
  else if (scoreData.inferences.embAc) {
    query.embAcResult = testCrashText(deficitData.ebmAc, 'ebmAc');
  }
  else {
    query.embAcResult = customSucceedText('embAc');
  }
  if (deficit.focAll) {
    const failures = customFailures(testData.focAll.result);
    query.focAllResult = customResult(deficit.focAll, 'focAll', failures);
  }
  else if (scoreData.inferences.focAll) {
    query.focAllResult = testCrashText(deficitData.focAll, 'focAll');
  }
  else {
    query.focAllResult = customSucceedText('focAll');
  }
  if (deficit.focInd) {
    const failSource = testData.focInd.result.totals.types;
    const failObj = {
      indicatorMissing: failSource.indicatorMissing.total,
      nonOutlinePresent: failSource.nonOutlinePresent.total
    };
    const failures = customFailures(failObj);
    query.focIndResult = customResult(deficit.focInd, 'focInd', failures);
  }
  else if (scoreData.inferences.focInd) {
    query.focIndResult = testCrashText(deficitData.focInd, 'focInd');
  }
  else {
    query.focIndResult = customSucceedText('focInd');
  }
  if (deficit.focOp) {
    const failSource = testData.focOp.result.totals.types;
    const failObj = {
      onlyFocusable: failSource.onlyFocusable.total,
      onlyOperable: failSource.onlyOperable.total
    };
    const failures = customFailures(failObj);
    query.focOpResult = customResult(deficit.focOp, 'focOp', failures);
  }
  else if (scoreData.inferences.focOp) {
    query.focOpResult = testCrashText(deficitData.focOp, 'focOp');
  }
  else {
    query.focOpResult = customSucceedText('focOp');
  }
  if (deficit.hover) {
    const failures = customFailures(testData.hover.result.totals);
    query.hoverResult = customResult(deficit.hover, 'hover', failures);
  }
  else if (scoreData.inferences.hover) {
    query.hoverResult = testCrashText(deficitData.hover, 'hover');
  }
  else {
    query.hoverResult = customSucceedText('hover');
  }
  if (deficit.labClash) {
    const {totals} = testData.labClash.result;
    delete totals.wellLabeled;
    const failures = customFailures(totals);
    query.labClashResult = customResult(deficit.labClash, 'labClash', failures);
  }
  else if (scoreData.inferences.labClash) {
    query.labClashResult = testCrashText(deficitData.labClash, 'labClash');
  }
  else {
    query.labClashResult = customSucceedText('labClash');
  }
  if (deficit.linkUl) {
    const failures = customFailures(testData.linkUl.result.totals.inline);
    query.linkUlResult = customResult(deficit.linkUl, 'linkUl', failures);
  }
  else if (scoreData.inferences.linkUl) {
    query.linkUlResult = testCrashText(deficitData.linkUl, 'linkUl');
  }
  else {
    query.linkUlResult = customSucceedText('linkUl');
  }
  if (deficit.log) {
    const {logCount, logSize, visitRejectionCount, prohibitedCount, visitTimeoutCount} = sourceData;
    const logData = {logCount, logSize, visitRejectionCount, prohibitedCount, visitTimeoutCount};
    const failures = customFailures(logData);
    query.logResult = customResult(deficit.log, 'log', failures);
  }
  else if (scoreData.inferences.log) {
    query.logResult = testCrashText(deficitData.log, 'log');
  }
  else {
    query.logResult = customSucceedText('log');
  }
  if (deficit.menuNav) {
    const failSource = testData.menuNav.result.totals;
    const failObj = {
      navigations: failSource.navigations.all.incorrect,
      menuItems: failSource.menuItems.incorrect,
      menus: failSource.menus.incorrect
    };
    const failures = customFailures(failObj);
    query.menuNavResult = customResult(deficit.menuNav, 'menuNav', failures);
  }
  else if (scoreData.inferences.menuNav) {
    query.menuNavResult = testCrashText(deficitData.menuNav, 'menuNav');
  }
  else {
    query.menuNavResult = customSucceedText('menuNav');
  }
  if (deficit.motion) {
    const {result} = testData.motion;
    result.bytes = result.bytes.join(', ');
    result.localRatios = result.localRatios.join(', ');
    result.pixelChanges = result.pixelChanges.join(', ');
    const failures = customFailures(result);
    query.motionResult = customResult(deficit.motion, 'motion', failures);
  }
  else if (scoreData.inferences.motion) {
    query.motionResult = testCrashText(deficitData.motion, 'motion');
  }
  else {
    query.motionResult = customSucceedText('motion');
  }
  if (deficit.radioSet) {
    const failures = customFailures(testData.radioSet.result.totals);
    query.radioSetResult = customResult(deficit.radioSet, 'radioSet', failures);
  }
  else if (scoreData.inferences.radioSet) {
    query.radioSetResult = testCrashText(deficitData.radioSet, 'radioSet');
  }
  else {
    query.radioSetResult = customSucceedText('radioSet');
  }
  if (deficit.role) {
    const {result} = testData.role;
    delete result.tagNames;
    const failures = customFailures(result);
    query.roleResult = customResult(deficit.role, 'role', failures);
  }
  else if (scoreData.inferences.role) {
    query.roleResult = testCrashText(deficitData.role, 'role');
  }
  else {
    query.roleResult = customSucceedText('role');
  }
  if (deficit.styleDiff) {
    const {totals} = testData.styleDiff.result;
    const styleCounts = {};
    Object.keys(totals).forEach(key => {
      const data = totals[key];
      const count = data.subtotals ? data.subtotals.length : 1;
      styleCounts[key] = `${count} ${count === 1 ? 'style' : 'different styles'}`;
    });
    const failures = customFailures(styleCounts);
    query.styleDiffResult = customResult(deficit.styleDiff, 'styleDiff', failures);
  }
  else if (scoreData.inferences.styleDiff) {
    query.styleDiffResult = testCrashText(deficitData.styleDiff, 'styleDiff');
  }
  else {
    query.roleResult = customSucceedText('role');
  }
  if (deficit.tabNav) {
    const failSource = testData.tabNav.result.totals;
    const failObj = {
      navigations: failSource.navigations.all.incorrect,
      tabElements: failSource.tabElements.incorrect,
      tabLists: failSource.tabLists.incorrect
    };
    const failures = customFailures(failObj);
    query.tabNavResult = customResult(deficit.tabNav, 'tabNav', failures);
  }
  else if (scoreData.inferences.tabNav) {
    query.tabNavResult = testCrashText(deficitData.tabNav, 'tabNav');
  }
  else {
    query.tabNavResult = customSucceedText('tabNav');
  }
  if (deficit.zIndex) {
    const {tagNames} = testData.zIndex.result.totals;
    const failures = customFailures(tagNames);
    query.zIndexResult = customResult(deficit.zIndex, 'zIndex', failures);
  }
  else if (scoreData.inferences.zIndex) {
    query.zIndexResult = testCrashText(deficitData.zIndex, 'zIndex');
  }
  else {
    query.zIndexResult = customSucceedText('zIndex');
  }
  return query;
};
