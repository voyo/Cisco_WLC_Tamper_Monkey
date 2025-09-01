# MAC Device Name Column for Wireless LAN Controller

A Tampermonkey userscript that adds device names to MAC address tables in Cisco Wireless LAN Controller (WLC) interfaces.

## Features

- **Dynamic Device Name Column**: Automatically adds a "Device Name" column next to MAC addresses in client tables
- **Dynamic Data Loading**: Fetches device names from a remote endpoint in real-time
- **Cross-Frame Support**: Works with framesets and nested iframes
- **CORS Bypass**: Uses Tampermonkey's GM_xmlhttpRequest to avoid cross-origin restrictions
- **Fallback Handling**: Gracefully handles connection failures with default device mappings
- **Non-Intrusive**: Preserves original MAC address functionality and clickable links

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Copy the userscript code from `mac-device-name-column.user.js`
3. Create a new userscript in Tampermonkey and paste the code
4. Save and enable the script

## Configuration

The script automatically fetches device mappings from:
```
http://10.0.0.6/devices/index.php?action=export_txt
```

Expected data format:
```
MAC_ADDRESS;IP_ADDRESS;DEVICE_NAME
34:ea:e7:eb:yy:xx;10.0.0.25;Sofar
80:7b:3e:30:yy:xx;10.0.0.30;Samsung S10
```

To use a different data source, modify the URL in the `loadMacData()` function.

## Supported Pages

The script activates on these WLC interface pages:
- `http://10.0.0.8/screens/apf/mobile_station_list.html`
- `http://10.0.0.8/screens/frameset.html` 
- `http://10.0.0.8/screens/frameMonitor.html`

## How It Works

1. **Data Loading**: On page load, fetches device mappings from the configured endpoint
2. **Table Detection**: Identifies tables containing "Client MAC Addr" headers
3. **Column Insertion**: Adds "Device Name" column after the MAC address column
4. **MAC Matching**: Matches MAC addresses in table cells with device mappings
5. **Name Display**: Shows device names for known devices, "-" for unknown ones

## Browser Compatibility

- Chrome/Chromium with Tampermonkey
- Firefox with Tampermonkey
- Edge with Tampermonkey

## Troubleshooting

**Script not loading device names:**
- Check browser console for error messages
- Verify the data endpoint is accessible
- Confirm data format matches expected structure

**Column appears in wrong position:**
- The script automatically detects MAC column position
- Device Name column is inserted immediately after MAC column

**Network issues:**
- Script includes fallback to default device mappings
- Check CORS configuration if using custom endpoints

## License

This project is provided as-is for network administration purposes.

