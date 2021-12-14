const vscode = require("vscode");
const { getVariable } = require("color2variable");
const extionTypes = require("./type");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const disposable = vscode.commands.registerTextEditorCommand(
    "color2variable.color-to-variable",
    function (textEditor, textEditorEdit) {
      var regexStr = "#([0-9 a-z A-Z]{3}){1,2}";
      placeholder(
        regexStr,
        (match, value) => {
          let content = match;
          const type = getExtensionType(
            vscode.window.activeTextEditor.document.fileName
          );

          const colorValue = match.slice(1);
          // 格式化颜色值：#fff -> #ffffff
          if (colorValue.length === 3) {
            content = `#${colorValue}${colorValue}`;
          }

          if (!getVariable(content)) {
            vscode.window.showWarningMessage(`${match} 未找到对应的变量`);
            return match;
          }

          // 处理 .less .scss .sass 后缀文件
          return `${extionTypes[type] || ""}${getVariable(content)}`;
        },
        textEditor,
        textEditorEdit
      );
    }
  );
  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {}

function getExtensionType(str) {
  const index = str.lastIndexOf(".");
  return str.slice(index + 1);
}

function placeholder(regexString, replaceFunction, textEditor, textEditorEdit) {
  let regexExp = new RegExp(regexString, "i");
  let regexExpG = new RegExp(regexString, "ig");
  // clones selections
  const selections = textEditor.selections;
  // Check if there is some text selected
  if (
    (selections.length == 0 ||
      selections.reduce((acc, val) => acc || val.isEmpty),
    false)
  ) {
    return;
  }
  // Get configuration options
  const config = vscode.workspace.getConfiguration("color2variable");
  const onlyChangeFirst = config.get("only-change-first-ocurrence");
  const warningIfNoChanges = config.get("notify-if-no-changes");
  const changesMade = new Map();
  textEditor
    .edit((builder) => {
      // Declaration of auxiliar variables
      let numOcurrences = 0;
      selections.forEach((selection) => {
        // Iterates over each selected line
        for (
          var index = selection.start.line;
          index <= selection.end.line;
          index++
        ) {
          let start = 0,
            end = textEditor.document.lineAt(index).range.end.character;
          // Gets the first and last selected characters for the line
          if (index === selection.start.line) {
            let tmpSelection = selection.with({ end: selection.start });
            let range = findValueRangeToConvert(
              tmpSelection,
              regexString,
              textEditor
            );
            if (range) {
              start = range.start.character;
            } else {
              start = selection.start.character;
            }
          }
          if (index === selection.end.line) {
            let tmpSelection = selection.with({ start: selection.end });
            let range = findValueRangeToConvert(
              tmpSelection,
              regexString,
              textEditor
            );
            if (range) {
              end = range.end.character;
            } else {
              end = selection.end.character;
            }
          }
          // Gets the text of the line
          let text = textEditor.document.lineAt(index).text.slice(start, end);
          // Counts the number of times the regex appears in the line
          const matches = text.match(regexExpG);
          numOcurrences += matches ? matches.length : 0;
          if (numOcurrences == 0) {
            continue;
          } // No ocurrences, so it's worth continuing
          const regex = onlyChangeFirst ? regexExp : regexExpG;
          const newText = text.replace(regex, replaceFunction);
          // Replace text in the text file
          const selectionTmp = new vscode.Selection(index, start, index, end);
          const key = `${index}-${start}-${end}`;
          if (!changesMade.has(key)) {
            changesMade.set(key, true);
            builder.replace(selectionTmp, newText);
          }
        }
        return;
      }, this);
      if (warningIfNoChanges && numOcurrences == 0) {
        vscode.window.showWarningMessage("There were no values to transform");
      }
    })
    .then((success) => {
      textEditor.selections.forEach((selection, index, newSelections) => {
        if (selections[index].start.isEqual(selections[index].end)) {
          const newPosition = selection.end;
          const newSelection = new vscode.Selection(newPosition, newPosition);
          textEditor.selections[index] = newSelection;
        }
      });
      textEditor.selections = textEditor.selections;
      if (!success) {
        console.log(`Error: ${success}`);
      }
    });
}

function findValueRangeToConvert(selection, regexString, textEditor) {
  const line = selection.start.line;
  const startChar = selection.start.character;
  const text = textEditor.document.lineAt(line).text;
  const regexExpG = new RegExp(regexString, "ig");

  let result;
  while ((result = regexExpG.exec(text))) {
    const resultStart = result.index;
    const resultEnd = result.index + result[0].length;
    if (startChar >= resultStart && startChar <= resultEnd) {
      return new vscode.Range(line, resultStart, line, resultEnd);
    }
  }
  return null;
}

module.exports = {
  activate,
  deactivate,
};
