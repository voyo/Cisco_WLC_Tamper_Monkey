// ==UserScript==
// @name         Dynamic MAC Device Name Column
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Dodaje kolumnę z nazwami urządzeń - pobiera dane dynamicznie z http://10.0.20.6/devices/index.php?action=export_txt
// @author       You
// @match        http://10.0.20.8/screens/apf/mobile_station_list.html*
// @match        https://10.0.20.8/screens/apf/mobile_station_list.html*
// @match        http://10.0.20.8/screens/frameset.html*
// @match        https://10.0.20.8/screens/frameset.html*
// @match        http://10.0.20.8/screens/frameMonitor.html*
// @match        https://10.0.20.8/screens/frameMonitor.html*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Dynamiczna tabela MAC - będzie pobrana ze strony
    let macToNameTable = {};
    let isDataLoaded = false;

    let scriptInstance = Math.random().toString(36).substr(2, 5);
    let processedTables = new WeakSet();

    console.log(`[MAC-${scriptInstance}] Skrypt uruchomiony na:`, window.location.href);

    // Funkcja do pobierania danych MAC ze strony (używa GM_xmlhttpRequest żeby ominąć CORS)
    async function loadMacData() {
        return new Promise((resolve) => {
            console.log(`[MAC-${scriptInstance}] Pobieranie danych MAC z http://10.0.20.6/devices/index.php?action=export_txt (omijanie CORS)`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://10.0.20.6/devices/index.php?action=export_txt',
                timeout: 10000, // 10 sekund timeout
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const textData = response.responseText;
                            console.log(`[MAC-${scriptInstance}] ✅ Pobrano dane (${textData.length} znaków)`);

                            // Parsuj format: MAC;IP;Nazwa
                            const lines = textData.split('\n');
                            let parsedCount = 0;

                            macToNameTable = {}; // Wyczyść tabelę

                            lines.forEach((line, index) => {
                                const trimmedLine = line.trim();
                                if (!trimmedLine) return; // Pomiń puste linie

                                const parts = trimmedLine.split(';');
                                if (parts.length >= 3) {
                                    const mac = parts[0].trim();
                                    const ip = parts[1].trim();
                                    const name = parts[2].trim();

                                    // Sprawdź czy MAC ma prawidłowy format
                                    if (mac.match(/^([0-9a-fA-F]{2}[:]){5}[0-9a-fA-F]{2}$/)) {
                                        const normalizedMac = mac.toLowerCase();
                                        macToNameTable[normalizedMac] = name;
                                        parsedCount++;

                                        if (parsedCount <= 5) { // Pokaż tylko pierwsze 5 dla czytelności
                                            console.log(`[MAC-${scriptInstance}] Dodano: ${mac} -> ${name}`);
                                        }
                                    } else {
                                        console.log(`[MAC-${scriptInstance}] Pomijam nieprawidłowy MAC w linii ${index + 1}: "${trimmedLine}"`);
                                    }
                                } else {
                                    if (trimmedLine.length > 0) { // Tylko nie-puste linie
                                        console.log(`[MAC-${scriptInstance}] Pomijam nieprawidłową linię ${index + 1}: "${trimmedLine}"`);
                                    }
                                }
                            });

                            isDataLoaded = true;
                            console.log(`[MAC-${scriptInstance}] ✅ Załadowano ${parsedCount} urządzeń z ${lines.length} linii`);
                            console.log(`[MAC-${scriptInstance}] Przykładowe urządzenia:`, Object.keys(macToNameTable).slice(0, 3));

                            resolve(true);
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (error) {
                        console.error(`[MAC-${scriptInstance}] ❌ Błąd parsowania danych:`, error);
                        loadFallbackData();
                        resolve(false);
                    }
                },
                onerror: function(error) {
                    console.error(`[MAC-${scriptInstance}] ❌ Błąd połączenia:`, error);
                    loadFallbackData();
                    resolve(false);
                },
                ontimeout: function() {
                    console.error(`[MAC-${scriptInstance}] ❌ Timeout - serwer nie odpowiada`);
                    loadFallbackData();
                    resolve(false);
                }
            });
        });
    }

    // Funkcja fallback z domyślnymi danymi
    function loadFallbackData() {
        macToNameTable = {
            '80:7b:3e:30:12:97': 'android_SamsungS10',
            '80:6c:1b:4c:a2:7b': 'android_doogeeS41',
            '00:05:cd:b9:f3:a4': 'denon-AVR',
            'ff:ee:dd:cc:bb:aa': 'Tablet iPad'
        };
        isDataLoaded = true;
        console.log(`[MAC-${scriptInstance}] Używam domyślnych danych (${Object.keys(macToNameTable).length} urządzeń)`);
    }

    // Regex dla MAC
    const macRegex = /\b([0-9a-fA-F]{2}[:]){5}[0-9a-fA-F]{2}\b/g;

    // Normalizacja MAC
    function normalizeMac(mac) {
        return mac.toLowerCase().replace(/[-]/g, ':');
    }

    // Główna funkcja - dodaj kolumnę
    function addDeviceNameColumn() {
        if (!isDataLoaded) {
            console.log(`[MAC-${scriptInstance}] Dane MAC jeszcze nie załadowane, czekam...`);
            return;
        }

        console.log(`[MAC-${scriptInstance}] Szukam tabeli z klientami... (${Object.keys(macToNameTable).length} urządzeń w bazie)`);

        // Znajdź wszystkie tabele
        const tables = document.querySelectorAll('table');

        tables.forEach((table, index) => {
            // Pomiń już przetworzone
            if (processedTables.has(table)) {
                return;
            }

            // Sprawdź czy to tabela z klientami
            const tableText = table.innerText;
            if (!tableText.includes('Client MAC Addr')) {
                return;
            }

            console.log(`[MAC-${scriptInstance}] ✅ Znaleziono tabelę klientów ${index + 1}`);

            try {
                // Znajdź wiersz nagłówków
                const rows = table.querySelectorAll('tr');
                let headerRow = null;
                let macColumnIndex = -1;

                // Znajdź wiersz z nagłówkami
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.querySelectorAll('th, td');

                    for (let j = 0; j < cells.length; j++) {
                        if (cells[j].textContent.includes('Client MAC Addr')) {
                            headerRow = row;
                            macColumnIndex = j;
                            console.log(`[MAC-${scriptInstance}] Znaleziono nagłówek MAC w kolumnie ${j}`);
                            break;
                        }
                    }
                    if (headerRow) break;
                }

                if (!headerRow || macColumnIndex === -1) {
                    console.log(`[MAC-${scriptInstance}] Nie znaleziono nagłówka MAC`);
                    return;
                }

                // Sprawdź czy kolumna "Device Name" już istnieje
                const existingDeviceName = Array.from(headerRow.querySelectorAll('th, td')).find(cell =>
                    cell.textContent.trim() === 'Device Name'
                );

                if (existingDeviceName) {
                    console.log(`[MAC-${scriptInstance}] Kolumna Device Name już istnieje`);
                    processedTables.add(table);
                    return;
                }

                // Dodaj nagłówek "Device Name" zaraz po kolumnie MAC
                const deviceHeader = document.createElement('th');
                deviceHeader.textContent = 'Device Name';
                deviceHeader.style.cssText = 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 5px; font-weight: bold;';

                // Wstaw nagłówek po kolumnie MAC (bezpiecznie)
                const headerCells = headerRow.querySelectorAll('th, td');
                if (macColumnIndex + 1 < headerCells.length) {
                    headerCells[macColumnIndex + 1].parentNode.insertBefore(deviceHeader, headerCells[macColumnIndex + 1]);
                } else {
                    headerRow.appendChild(deviceHeader);
                }

                console.log(`[MAC-${scriptInstance}] ✅ Dodano nagłówek Device Name po kolumnie ${macColumnIndex}`);

                // Przetwórz wszystkie wiersze danych
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (row === headerRow) continue; // Pomiń nagłówek

                    const cells = row.querySelectorAll('td');
                    if (cells.length <= macColumnIndex) {
                        console.log(`[MAC-${scriptInstance}] Pomijam wiersz ${i} - za mało komórek (${cells.length})`);
                        continue;
                    }

                    const macCell = cells[macColumnIndex];
                    const macText = macCell.textContent.trim();

                    console.log(`[MAC-${scriptInstance}] Wiersz ${i}: Tekst komórki MAC: "${macText}"`);
                    console.log(`[MAC-${scriptInstance}] Wiersz ${i}: HTML komórki MAC: "${macCell.innerHTML.substring(0, 100)}"`);

                    // Sprawdź czy jest MAC w tej komórce (tekst lub HTML)
                    let macMatch = macText.match(macRegex);
                    if (!macMatch) {
                        macMatch = macCell.innerHTML.match(macRegex);
                        if (macMatch) {
                            console.log(`[MAC-${scriptInstance}] Wiersz ${i}: MAC znaleziony w HTML: ${macMatch[0]}`);
                        }
                    } else {
                        console.log(`[MAC-${scriptInstance}] Wiersz ${i}: MAC znaleziony w tekście: ${macMatch[0]}`);
                    }

                    let deviceName = '-';

                    if (macMatch && macMatch.length > 0) {
                        const mac = macMatch[0];
                        const normalizedMac = normalizeMac(mac);
                        deviceName = macToNameTable[normalizedMac] || '-';

                        console.log(`[MAC-${scriptInstance}] Wiersz ${i}: MAC=${mac}, Normalized=${normalizedMac}, Nazwa=${deviceName}`);

                        if (macToNameTable[normalizedMac]) {
                            console.log(`[MAC-${scriptInstance}] ✅ Znaleziono urządzenie: ${mac} -> ${deviceName}`);
                        }
                    } else {
                        console.log(`[MAC-${scriptInstance}] Wiersz ${i}: Brak MAC w komórce`);
                    }

                    // Dodaj komórkę z nazwą urządzenia
                    const deviceCell = document.createElement('td');
                    deviceCell.textContent = deviceName;
                    deviceCell.style.cssText = 'border: 1px solid #ccc; padding: 5px;';

                    if (deviceName !== '-') {
                        deviceCell.style.color = '#2e7d32';
                        deviceCell.style.fontWeight = 'bold';
                    } else {
                        deviceCell.style.color = '#999';
                        deviceCell.style.fontStyle = 'italic';
                    }

                    // Wstaw komórkę zaraz po komórce MAC (bezpiecznie)
                    const currentCells = row.querySelectorAll('td');
                    if (macColumnIndex + 1 < currentCells.length) {
                        currentCells[macColumnIndex + 1].parentNode.insertBefore(deviceCell, currentCells[macColumnIndex + 1]);
                    } else {
                        row.appendChild(deviceCell);
                    }

                    console.log(`[MAC-${scriptInstance}] Wiersz ${i}: Dodano komórkę z nazwą "${deviceName}"`);
                }

                // Oznacz tabelę jako przetworzoną
                processedTables.add(table);
                console.log(`[MAC-${scriptInstance}] ✅ Tabela przetworzona`);

            } catch (error) {
                console.error(`[MAC-${scriptInstance}] Błąd:`, error);
            }
        });
    }

    // Funkcja do obsługi frame'ów
    function processFrames() {
        if (!isDataLoaded) {
            console.log(`[MAC-${scriptInstance}] Dane MAC jeszcze nie załadowane dla frame'ów, czekam...`);
            return;
        }

        const frames = document.querySelectorAll('frame, iframe');

        frames.forEach((frame, index) => {
            try {
                const frameDoc = frame.contentDocument || frame.contentWindow?.document;

                if (frameDoc && frameDoc.location.href.includes('mobile_station_list.html')) {
                    console.log(`[MAC-${scriptInstance}] Przetwarzam frame z listą klientów (${Object.keys(macToNameTable).length} urządzeń)`);

                    // Uruchom funkcję w kontekście frame'a
                    setTimeout(() => {
                        const tables = frameDoc.querySelectorAll('table');
                        tables.forEach((table, tableIndex) => {
                            if (processedTables.has(table)) return;

                            const tableText = table.innerText;
                            if (!tableText.includes('Client MAC Addr')) return;

                            console.log(`[MAC-${scriptInstance}] Frame: znaleziono tabelę ${tableIndex + 1}`);

                            // Kopiuj logikę dodawania kolumny
                            const rows = table.querySelectorAll('tr');
                            let headerRow = null;
                            let macColumnIndex = -1;

                            for (let i = 0; i < rows.length; i++) {
                                const row = rows[i];
                                const cells = row.querySelectorAll('th, td');

                                for (let j = 0; j < cells.length; j++) {
                                    if (cells[j].textContent.includes('Client MAC Addr')) {
                                        headerRow = row;
                                        macColumnIndex = j;
                                        break;
                                    }
                                }
                                if (headerRow) break;
                            }

                            if (!headerRow || macColumnIndex === -1) return;

                            // Sprawdź czy kolumna już istnieje
                            const existingDeviceName = Array.from(headerRow.querySelectorAll('th, td')).find(cell =>
                                cell.textContent.trim() === 'Device Name'
                            );

                            if (existingDeviceName) {
                                processedTables.add(table);
                                return;
                            }

                            // Dodaj nagłówek zaraz po kolumnie MAC (tak jak w głównej funkcji)
                            const deviceHeader = frameDoc.createElement('th');
                            deviceHeader.textContent = 'Device Name';
                            deviceHeader.style.cssText = 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 5px; font-weight: bold;';

                            // Wstaw nagłówek po kolumnie MAC (bezpiecznie)
                            const headerCells = headerRow.querySelectorAll('th, td');
                            if (macColumnIndex + 1 < headerCells.length) {
                                headerCells[macColumnIndex + 1].parentNode.insertBefore(deviceHeader, headerCells[macColumnIndex + 1]);
                            } else {
                                headerRow.appendChild(deviceHeader);
                            }

                            // Dodaj komórki danych
                            for (let i = 0; i < rows.length; i++) {
                                const row = rows[i];
                                if (row === headerRow) continue;

                                const cells = row.querySelectorAll('td');
                                if (cells.length <= macColumnIndex) continue;

                                const macCell = cells[macColumnIndex];
                                const macText = macCell.textContent.trim();

                                console.log(`[MAC-${scriptInstance}] Frame - sprawdzam wiersz ${i}: "${macText}"`);

                                // Sprawdź MAC w tekście i HTML
                                let macMatch = macText.match(macRegex);
                                if (!macMatch) {
                                    macMatch = macCell.innerHTML.match(macRegex);
                                }

                                let deviceName = '-';

                                if (macMatch && macMatch.length > 0) {
                                    const mac = macMatch[0];
                                    const normalizedMac = normalizeMac(mac);
                                    deviceName = macToNameTable[normalizedMac] || '-';

                                    console.log(`[MAC-${scriptInstance}] Frame - MAC: ${mac} -> ${deviceName}`);
                                }

                                const deviceCell = frameDoc.createElement('td');
                                deviceCell.textContent = deviceName;
                                deviceCell.style.cssText = 'border: 1px solid #ccc; padding: 5px;';

                                if (deviceName !== '-') {
                                    deviceCell.style.color = '#2e7d32';
                                    deviceCell.style.fontWeight = 'bold';
                                } else {
                                    deviceCell.style.color = '#999';
                                    deviceCell.style.fontStyle = 'italic';
                                }

                                // Wstaw komórkę zaraz po komórce MAC (tak jak w głównej funkcji)
                                const currentCells = row.querySelectorAll('td');
                                if (macColumnIndex + 1 < currentCells.length) {
                                    currentCells[macColumnIndex + 1].parentNode.insertBefore(deviceCell, currentCells[macColumnIndex + 1]);
                                } else {
                                    row.appendChild(deviceCell);
                                }
                            }

                            processedTables.add(table);
                            console.log(`[MAC-${scriptInstance}] ✅ Frame: tabela przetworzona`);
                        });
                    }, 1000);
                }
            } catch (error) {
                console.log(`[MAC-${scriptInstance}] Błąd dostępu do frame ${index + 1}`);
            }
        });
    }

    // Uruchomienie
    async function init() {
        console.log(`[MAC-${scriptInstance}] === INICJALIZACJA ===`);

        // Sprawdź czy to właściwa strona
        const currentURL = window.location.href;
        if (!currentURL.includes('mobile_station_list.html') &&
            !currentURL.includes('frameset.html') &&
            !currentURL.includes('frameMonitor.html')) {
            console.log(`[MAC-${scriptInstance}] Pomijam tę stronę`);
            return;
        }

        // Najpierw załaduj dane MAC
        console.log(`[MAC-${scriptInstance}] Ładowanie danych MAC...`);
        await loadMacData();

        if (!isDataLoaded) {
            console.log(`[MAC-${scriptInstance}] ❌ Nie udało się załadować danych MAC`);
            return;
        }

        console.log(`[MAC-${scriptInstance}] ✅ Dane MAC załadowane, rozpoczynam przetwarzanie tabel...`);

        // Teraz przetwórz tabele
        if (currentURL.includes('mobile_station_list.html')) {
            setTimeout(addDeviceNameColumn, 1000);
            setTimeout(addDeviceNameColumn, 3000);
            setTimeout(addDeviceNameColumn, 5000);
        }

        // Przetwórz frame'y
        if (currentURL.includes('frameset.html') || currentURL.includes('frameMonitor.html')) {
            setTimeout(processFrames, 2000);
            setTimeout(processFrames, 5000);
            setTimeout(processFrames, 8000);
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(error => {
                console.error(`[MAC-${scriptInstance}] Błąd inicjalizacji:`, error);
            });
        });
    } else {
        setTimeout(() => {
            init().catch(error => {
                console.error(`[MAC-${scriptInstance}] Błąd inicjalizacji:`, error);
            });
        }, 100);
    }

    console.log(`[MAC-${scriptInstance}] Simple MAC Device Name Column - załadowany (wersja dynamiczna)`);

})();
