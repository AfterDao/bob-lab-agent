# Python 開發環境

## 建立虛擬環境

在專案根目錄執行 `python -m venv .venv` 建立環境。Windows PowerShell 可使用 `.\.venv\Scripts\Activate.ps1` 啟用。啟用後確認 `python` 與 `pip` 指向 `.venv` 內的執行檔。

## 安裝套件

依照專案提供的 `requirements.txt` 或 `pyproject.toml` 安裝套件。不要直接在系統 Python 中安裝所有套件。新增依賴時應記錄版本，確保其他成員能重建相同環境。

## 常見問題

出現 module not found 時，先確認虛擬環境是否啟用、套件是否安裝在目前 interpreter，以及 VS Code 是否選到同一個 interpreter。不要在未確認環境前反覆安裝同一套件。
