@echo off
echo Installing dependencies...
pip install -r requirements.txt

echo Starting Label Automate application...
python app.py

pause