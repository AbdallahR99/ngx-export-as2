import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
// import HTMLtoDOCX from 'html-to-docx';
import html2pdf from 'html2pdf.js';
import * as i0 from "@angular/core";
window['html2canvas'] = html2canvas;
export class ExportAsService {
    constructor() { }
    /**
     * Main base64 get method, it will return the file as base64 string
     * @param config your config
     */
    get(config) {
        // structure method name dynamically by type
        const func = 'get' + config.type.toUpperCase();
        // if type supported execute and return
        if (this[func]) {
            return this[func](config);
        }
        // throw error for unsupported formats
        return new Observable((observer) => { observer.error('Export type is not supported.'); });
    }
    /**
     * Save exported file in old javascript way
     * @param config your custom config
     * @param fileName Name of the file to be saved as
     */
    save(config, fileName) {
        // set download
        config.download = true;
        // get file name with type
        config.fileName = fileName + '.' + config.type;
        return this.get(config);
    }
    /**
     * Converts content string to blob object
     * @param content string to be converted
     */
    contentToBlob(content) {
        return new Observable((observer) => {
            // get content string and extract mime type
            const arr = content.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            observer.next(new Blob([u8arr], { type: mime }));
            observer.complete();
        });
    }
    /**
     * Removes base64 file type from a string like "data:text/csv;base64,"
     * @param fileContent the base64 string to remove the type from
     */
    removeFileTypeFromBase64(fileContent) {
        const re = /^data:[^]*;base64,/g;
        const newContent = re[Symbol.replace](fileContent, '');
        return newContent;
    }
    /**
     * Structure the base64 file content with the file type string
     * @param fileContent file content
     * @param fileMime file mime type "text/csv"
     */
    addFileTypeToBase64(fileContent, fileMime) {
        return `data:${fileMime};base64,${fileContent}`;
    }
    /**
     * create downloadable file from dataURL
     * @param fileName downloadable file name
     * @param dataURL file content as dataURL
     */
    downloadFromDataURL(fileName, dataURL) {
        // create blob
        this.contentToBlob(dataURL).subscribe(blob => {
            // download the blob
            this.downloadFromBlob(blob, fileName);
        });
    }
    /**
     * Downloads the blob object as a file
     * @param blob file object as blob
     * @param fileName downloadable file name
     */
    downloadFromBlob(blob, fileName) {
        // get object url
        const url = window.URL.createObjectURL(blob);
        // check for microsoft internet explorer
        if (window.navigator && window.navigator['msSaveOrOpenBlob']) {
            // use IE download or open if the user using IE
            window.navigator['msSaveOrOpenBlob'](blob, fileName);
        }
        else {
            this.saveFile(fileName, url);
        }
    }
    saveFile(fileName, url) {
        // if not using IE then create link element
        const element = document.createElement('a');
        // set download attr with file name
        element.setAttribute('download', fileName);
        // set the element as hidden
        element.style.display = 'none';
        // append the body
        document.body.appendChild(element);
        // set href attr
        element.href = url;
        // click on it to start downloading
        element.click();
        // remove the link from the dom
        document.body.removeChild(element);
    }
    getPDF(config) {
        return new Observable((observer) => {
            if (!config.options) {
                config.options = {};
            }
            config.options.filename = config.fileName;
            const element = document.getElementById(config.elementIdOrContent);
            const pdf = html2pdf().set(config.options).from(element ? element : config.elementIdOrContent);
            const download = config.download;
            const pdfCallbackFn = config.options.pdfCallbackFn;
            if (download) {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).save();
                }
                else {
                    pdf.save();
                }
                observer.next();
                observer.complete();
            }
            else {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
                else {
                    pdf.outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
            }
        });
    }
    applyPdfCallbackFn(pdf, pdfCallbackFn) {
        return pdf.toPdf().get('pdf').then((pdfRef) => {
            pdfCallbackFn(pdfRef);
        });
    }
    getPNG(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            html2canvas(element, config.options).then((canvas) => {
                const imgData = canvas.toDataURL('image/PNG');
                if (config.type === 'png' && config.download) {
                    this.downloadFromDataURL(config.fileName, imgData);
                    observer.next();
                }
                else {
                    observer.next(imgData);
                }
                observer.complete();
            }, err => {
                observer.error(err);
            });
        });
    }
    getCSV(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const csv = [];
            const rows = element.querySelectorAll('table tr');
            for (let index = 0; index < rows.length; index++) {
                const rowElement = rows[index];
                const row = [];
                const cols = rowElement.querySelectorAll('td, th');
                for (let colIndex = 0; colIndex < cols.length; colIndex++) {
                    const col = cols[colIndex];
                    row.push('"' + col.innerText + '"');
                }
                csv.push(row.join(','));
            }
            const csvContent = 'data:text/csv;base64,' + this.btoa(csv.join('\n'));
            if (config.download) {
                this.downloadFromDataURL(config.fileName, csvContent);
                observer.next();
            }
            else {
                observer.next(csvContent);
            }
            observer.complete();
        });
    }
    getTXT(config) {
        const nameFrags = config.fileName.split('.');
        config.fileName = `${nameFrags[0]}.txt`;
        return this.getCSV(config);
    }
    getXLS(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const ws3 = XLSX.utils.table_to_sheet(element, config.options);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws3, config.fileName);
            const out = XLSX.write(wb, { type: 'base64' });
            const xlsContent = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + out;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, xlsContent);
                observer.next();
            }
            else {
                observer.next(xlsContent);
            }
            observer.complete();
        });
    }
    getXLSX(config) {
        return this.getXLS(config);
    }
    getDOCX(config) {
        return new Observable((observer) => {
            const contentDocument = document.getElementById(config.elementIdOrContent).outerHTML;
            const content = '<!DOCTYPE html>' + contentDocument;
            // HTMLtoDOCX(content, null, config.options).then(converted => {
            //   if (config.download) {
            //     this.downloadFromBlob(converted, config.fileName);
            //     observer.next();
            //     observer.complete();
            //   } else {
            //     const reader = new FileReader();
            //     reader.onloadend = () => {
            //       const base64data = reader.result as string;
            //       observer.next(base64data);
            //       observer.complete();
            //     };
            //     reader.readAsDataURL(converted);
            //   }
            // });
        });
    }
    getDOC(config) {
        return this.getDOCX(config);
    }
    getJSON(config) {
        return new Observable((observer) => {
            const data = []; // first row needs to be headers
            const headers = [];
            const table = document.getElementById(config.elementIdOrContent);
            for (let index = 0; index < table.rows[0].cells.length; index++) {
                headers[index] = table.rows[0].cells[index].innerHTML.toLowerCase().replace(/ /gi, '');
            }
            // go through cells
            for (let i = 1; i < table.rows.length; i++) {
                const tableRow = table.rows[i];
                const rowData = {};
                for (let j = 0; j < tableRow.cells.length; j++) {
                    rowData[headers[j]] = tableRow.cells[j].innerHTML;
                }
                data.push(rowData);
            }
            const jsonString = JSON.stringify(data);
            const jsonBase64 = this.btoa(jsonString);
            const dataStr = 'data:text/json;base64,' + jsonBase64;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, dataStr);
                observer.next();
            }
            else {
                observer.next(data);
            }
            observer.complete();
        });
    }
    getXML(config) {
        return new Observable((observer) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Classes>';
            const tritem = document.getElementById(config.elementIdOrContent).getElementsByTagName('tr');
            for (let i = 0; i < tritem.length; i++) {
                const celldata = tritem[i];
                if (celldata.cells.length > 0) {
                    xml += '<Class name="' + celldata.cells[0].textContent + '">\n';
                    for (let m = 1; m < celldata.cells.length; ++m) {
                        xml += '\t<data>' + celldata.cells[m].textContent + '</data>\n';
                    }
                    xml += '</Class>\n';
                }
            }
            xml += '</Classes></Root>';
            const base64 = 'data:text/xml;base64,' + this.btoa(xml);
            if (config.download) {
                this.downloadFromDataURL(config.fileName, base64);
                observer.next();
            }
            else {
                observer.next(base64);
            }
            observer.complete();
        });
    }
    btoa(content) {
        return btoa(unescape(encodeURIComponent(content)));
    }
}
ExportAsService.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "13.0.3", ngImport: i0, type: ExportAsService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
ExportAsService.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "13.0.3", ngImport: i0, type: ExportAsService });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "13.0.3", ngImport: i0, type: ExportAsService, decorators: [{
            type: Injectable
        }], ctorParameters: function () { return []; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LWFzLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtZXhwb3J0LWFzL3NyYy9saWIvZXhwb3J0LWFzLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUMzQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSWxDLE9BQU8sV0FBVyxNQUFNLGFBQWEsQ0FBQztBQUN0QyxPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3Qix5Q0FBeUM7QUFDekMsT0FBTyxRQUFRLE1BQU0sYUFBYSxDQUFDOztBQUNuQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUcsV0FBVyxDQUFDO0FBR3BDLE1BQU0sT0FBTyxlQUFlO0lBRTFCLGdCQUFnQixDQUFDO0lBRWpCOzs7T0FHRztJQUNILEdBQUcsQ0FBQyxNQUFzQjtRQUN4Qiw0Q0FBNEM7UUFDNUMsTUFBTSxJQUFJLEdBQUcsS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDL0MsdUNBQXVDO1FBQ3ZDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDM0I7UUFFRCxzQ0FBc0M7UUFDdEMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxJQUFJLENBQUMsTUFBc0IsRUFBRSxRQUFnQjtRQUMzQyxlQUFlO1FBQ2YsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDdkIsMEJBQTBCO1FBQzFCLE1BQU0sQ0FB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UUFBUSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRCxDQUFDOzs0R0EzVFUsZUFBZTtnSEFBZixlQUFlOzJGQUFmLGVBQWU7a0JBRDNCLFVBQVUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcclxuXHJcbmltcG9ydCB7IEV4cG9ydEFzQ29uZmlnIH0gZnJvbSAnLi9leHBvcnQtYXMtY29uZmlnLm1vZGVsJztcclxuXHJcbmltcG9ydCBodG1sMmNhbnZhcyBmcm9tICdodG1sMmNhbnZhcyc7XHJcbmltcG9ydCAqIGFzIFhMU1ggZnJvbSAneGxzeCc7XHJcbi8vIGltcG9ydCBIVE1MdG9ET0NYIGZyb20gJ2h0bWwtdG8tZG9jeCc7XHJcbmltcG9ydCBodG1sMnBkZiBmcm9tICdodG1sMnBkZi5qcyc7XHJcbndpbmRvd1snaHRtbDJjYW52YXMnXSA9IGh0bWwyY2FudmFzO1xyXG5cclxuQEluamVjdGFibGUoKVxyXG5leHBvcnQgY2xhc3MgRXhwb3J0QXNTZXJ2aWNlIHtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7IH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFpbiBiYXNlNjQgZ2V0IG1ldGhvZCwgaXQgd2lsbCByZXR1cm4gdGhlIGZpbGUgYXMgYmFzZTY0IHN0cmluZ1xyXG4gICAqIEBwYXJhbSBjb25maWcgeW91ciBjb25maWdcclxuICAgKi9cclxuICBnZXQoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgLy8gc3RydWN0dXJlIG1ldGhvZCBuYW1lIGR5bmFtaWNhbGx5IGJ5IHR5cGVcclxuICAgIGNvbnN0IGZ1bmMgPSAnZ2V0JyArIGNvbmZpZy50eXBlLnRvVXBwZXJDYXNlKCk7XHJcbiAgICAvLyBpZiB0eXBlIHN1cHBvcnRlZCBleGVjdXRlIGFuZCByZXR1cm5cclxuICAgIGlmICh0aGlzW2Z1bmNdKSB7XHJcbiAgICAgIHJldHVybiB0aGlzW2Z1bmNdKGNvbmZpZyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gdGhyb3cgZXJyb3IgZm9yIHVuc3VwcG9ydGVkIGZvcm1hdHNcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHsgb2JzZXJ2ZXIuZXJyb3IoJ0V4cG9ydCB0eXBlIGlzIG5vdCBzdXBwb3J0ZWQuJyk7IH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2F2ZSBleHBvcnRlZCBmaWxlIGluIG9sZCBqYXZhc2NyaXB0IHdheVxyXG4gICAqIEBwYXJhbSBjb25maWcgeW91ciBjdXN0b20gY29uZmlnXHJcbiAgICogQHBhcmFtIGZpbGVOYW1lIE5hbWUgb2YgdGhlIGZpbGUgdG8gYmUgc2F2ZWQgYXNcclxuICAgKi9cclxuICBzYXZlKGNvbmZpZzogRXhwb3J0QXNDb25maWcsIGZpbGVOYW1lOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIC8vIHNldCBkb3dubG9hZFxyXG4gICAgY29uZmlnLmRvd25sb2FkID0gdHJ1ZTtcclxuICAgIC8vIGdldCBmaWxlIG5hbWUgd2l0aCB0eXBlXHJcbiAgICBjb25maWcuZmlsZU5hbWUgPSBmaWxlTmFtZSArICcuJyArIGNvbmZpZy50eXBlO1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0KGNvbmZpZyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0cyBjb250ZW50IHN0cmluZyB0byBibG9iIG9iamVjdFxyXG4gICAqIEBwYXJhbSBjb250ZW50IHN0cmluZyB0byBiZSBjb252ZXJ0ZWRcclxuICAgKi9cclxuICBjb250ZW50VG9CbG9iKGNvbnRlbnQ6IHN0cmluZyk6IE9ic2VydmFibGU8QmxvYj4ge1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnNlcnZlcikgPT4ge1xyXG4gICAgICAvLyBnZXQgY29udGVudCBzdHJpbmcgYW5kIGV4dHJhY3QgbWltZSB0eXBlXHJcbiAgICAgIGNvbnN0IGFyciA9IGNvbnRlbnQuc3BsaXQoJywnKSwgbWltZSA9IGFyclswXS5tYXRjaCgvOiguKj8pOy8pWzFdLFxyXG4gICAgICAgIGJzdHIgPSBhdG9iKGFyclsxXSk7XHJcbiAgICAgIGxldCBuID0gYnN0ci5sZW5ndGg7XHJcbiAgICAgIGNvbnN0IHU4YXJyID0gbmV3IFVpbnQ4QXJyYXkobik7XHJcbiAgICAgIHdoaWxlIChuLS0pIHtcclxuICAgICAgICB1OGFycltuXSA9IGJzdHIuY2hhckNvZGVBdChuKTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5uZXh0KG5ldyBCbG9iKFt1OGFycl0sIHsgdHlwZTogbWltZSB9KSk7XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMgYmFzZTY0IGZpbGUgdHlwZSBmcm9tIGEgc3RyaW5nIGxpa2UgXCJkYXRhOnRleHQvY3N2O2Jhc2U2NCxcIlxyXG4gICAqIEBwYXJhbSBmaWxlQ29udGVudCB0aGUgYmFzZTY0IHN0cmluZyB0byByZW1vdmUgdGhlIHR5cGUgZnJvbVxyXG4gICAqL1xyXG4gIHJlbW92ZUZpbGVUeXBlRnJvbUJhc2U2NChmaWxlQ29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHJlID0gL15kYXRhOlteXSo7YmFzZTY0LC9nO1xyXG4gICAgY29uc3QgbmV3Q29udGVudDogc3RyaW5nID0gcmVbU3ltYm9sLnJlcGxhY2VdKGZpbGVDb250ZW50LCAnJyk7XHJcbiAgICByZXR1cm4gbmV3Q29udGVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0cnVjdHVyZSB0aGUgYmFzZTY0IGZpbGUgY29udGVudCB3aXRoIHRoZSBmaWxlIHR5cGUgc3RyaW5nXHJcbiAgICogQHBhcmFtIGZpbGVDb250ZW50IGZpbGUgY29udGVudFxyXG4gICAqIEBwYXJhbSBmaWxlTWltZSBmaWxlIG1pbWUgdHlwZSBcInRleHQvY3N2XCJcclxuICAgKi9cclxuICBhZGRGaWxlVHlwZVRvQmFzZTY0KGZpbGVDb250ZW50OiBzdHJpbmcsIGZpbGVNaW1lOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGBkYXRhOiR7ZmlsZU1pbWV9O2Jhc2U2NCwke2ZpbGVDb250ZW50fWA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBjcmVhdGUgZG93bmxvYWRhYmxlIGZpbGUgZnJvbSBkYXRhVVJMXHJcbiAgICogQHBhcmFtIGZpbGVOYW1lIGRvd25sb2FkYWJsZSBmaWxlIG5hbWVcclxuICAgKiBAcGFyYW0gZGF0YVVSTCBmaWxlIGNvbnRlbnQgYXMgZGF0YVVSTFxyXG4gICAqL1xyXG4gIGRvd25sb2FkRnJvbURhdGFVUkwoZmlsZU5hbWU6IHN0cmluZywgZGF0YVVSTDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAvLyBjcmVhdGUgYmxvYlxyXG4gICAgdGhpcy5jb250ZW50VG9CbG9iKGRhdGFVUkwpLnN1YnNjcmliZShibG9iID0+IHtcclxuICAgICAgLy8gZG93bmxvYWQgdGhlIGJsb2JcclxuICAgICAgdGhpcy5kb3dubG9hZEZyb21CbG9iKGJsb2IsIGZpbGVOYW1lKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRG93bmxvYWRzIHRoZSBibG9iIG9iamVjdCBhcyBhIGZpbGVcclxuICAgKiBAcGFyYW0gYmxvYiBmaWxlIG9iamVjdCBhcyBibG9iXHJcbiAgICogQHBhcmFtIGZpbGVOYW1lIGRvd25sb2FkYWJsZSBmaWxlIG5hbWVcclxuICAgKi9cclxuICBkb3dubG9hZEZyb21CbG9iKGJsb2I6IEJsb2IsIGZpbGVOYW1lOiBzdHJpbmcpIHtcclxuICAgIC8vIGdldCBvYmplY3QgdXJsXHJcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICAgIC8vIGNoZWNrIGZvciBtaWNyb3NvZnQgaW50ZXJuZXQgZXhwbG9yZXJcclxuICAgIGlmICh3aW5kb3cubmF2aWdhdG9yICYmIHdpbmRvdy5uYXZpZ2F0b3JbJ21zU2F2ZU9yT3BlbkJsb2InXSkge1xyXG4gICAgICAvLyB1c2UgSUUgZG93bmxvYWQgb3Igb3BlbiBpZiB0aGUgdXNlciB1c2luZyBJRVxyXG4gICAgICB3aW5kb3cubmF2aWdhdG9yWydtc1NhdmVPck9wZW5CbG9iJ10oYmxvYiwgZmlsZU5hbWUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zYXZlRmlsZShmaWxlTmFtZSwgdXJsKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2F2ZUZpbGUoZmlsZU5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcpIHtcclxuICAgIC8vIGlmIG5vdCB1c2luZyBJRSB0aGVuIGNyZWF0ZSBsaW5rIGVsZW1lbnRcclxuICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICAvLyBzZXQgZG93bmxvYWQgYXR0ciB3aXRoIGZpbGUgbmFtZVxyXG4gICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2Rvd25sb2FkJywgZmlsZU5hbWUpO1xyXG4gICAgLy8gc2V0IHRoZSBlbGVtZW50IGFzIGhpZGRlblxyXG4gICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgLy8gYXBwZW5kIHRoZSBib2R5XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xyXG4gICAgLy8gc2V0IGhyZWYgYXR0clxyXG4gICAgZWxlbWVudC5ocmVmID0gdXJsO1xyXG4gICAgLy8gY2xpY2sgb24gaXQgdG8gc3RhcnQgZG93bmxvYWRpbmdcclxuICAgIGVsZW1lbnQuY2xpY2soKTtcclxuICAgIC8vIHJlbW92ZSB0aGUgbGluayBmcm9tIHRoZSBkb21cclxuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBERihjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGlmICghY29uZmlnLm9wdGlvbnMpIHtcclxuICAgICAgICBjb25maWcub3B0aW9ucyA9IHt9O1xyXG4gICAgICB9XHJcbiAgICAgIGNvbmZpZy5vcHRpb25zLmZpbGVuYW1lID0gY29uZmlnLmZpbGVOYW1lO1xyXG4gICAgICBjb25zdCBlbGVtZW50OiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG4gICAgICBjb25zdCBwZGYgPSBodG1sMnBkZigpLnNldChjb25maWcub3B0aW9ucykuZnJvbShlbGVtZW50ID8gZWxlbWVudCA6IGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG5cclxuICAgICAgY29uc3QgZG93bmxvYWQgPSBjb25maWcuZG93bmxvYWQ7XHJcbiAgICAgIGNvbnN0IHBkZkNhbGxiYWNrRm4gPSBjb25maWcub3B0aW9ucy5wZGZDYWxsYmFja0ZuO1xyXG4gICAgICBpZiAoZG93bmxvYWQpIHtcclxuICAgICAgICBpZiAocGRmQ2FsbGJhY2tGbikge1xyXG4gICAgICAgICAgdGhpcy5hcHBseVBkZkNhbGxiYWNrRm4ocGRmLCBwZGZDYWxsYmFja0ZuKS5zYXZlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHBkZi5zYXZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICAgICAgICB0aGlzLmFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pLm91dHB1dFBkZignZGF0YXVyaXN0cmluZycpLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGRmLm91dHB1dFBkZignZGF0YXVyaXN0cmluZycpLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBseVBkZkNhbGxiYWNrRm4ocGRmLCBwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICByZXR1cm4gcGRmLnRvUGRmKCkuZ2V0KCdwZGYnKS50aGVuKChwZGZSZWYpID0+IHtcclxuICAgICAgcGRmQ2FsbGJhY2tGbihwZGZSZWYpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBORyhjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGh0bWwyY2FudmFzKGVsZW1lbnQsIGNvbmZpZy5vcHRpb25zKS50aGVuKChjYW52YXMpID0+IHtcclxuICAgICAgICBjb25zdCBpbWdEYXRhID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvUE5HJyk7XHJcbiAgICAgICAgaWYgKGNvbmZpZy50eXBlID09PSAncG5nJyAmJiBjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIGltZ0RhdGEpO1xyXG4gICAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KGltZ0RhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9LCBlcnIgPT4ge1xyXG4gICAgICAgIG9ic2VydmVyLmVycm9yKGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENTVihjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGNvbnN0IGNzdiA9IFtdO1xyXG4gICAgICBjb25zdCByb3dzOiBhbnkgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RhYmxlIHRyJyk7XHJcbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCByb3dzLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSByb3dzW2luZGV4XTtcclxuICAgICAgICBjb25zdCByb3cgPSBbXTtcclxuICAgICAgICBjb25zdCBjb2xzID0gcm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ZCwgdGgnKTtcclxuICAgICAgICBmb3IgKGxldCBjb2xJbmRleCA9IDA7IGNvbEluZGV4IDwgY29scy5sZW5ndGg7IGNvbEluZGV4KyspIHtcclxuICAgICAgICAgIGNvbnN0IGNvbCA9IGNvbHNbY29sSW5kZXhdO1xyXG4gICAgICAgICAgcm93LnB1c2goJ1wiJytjb2wuaW5uZXJUZXh0KydcIicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjc3YucHVzaChyb3cuam9pbignLCcpKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBjc3ZDb250ZW50ID0gJ2RhdGE6dGV4dC9jc3Y7YmFzZTY0LCcgKyB0aGlzLmJ0b2EoY3N2LmpvaW4oJ1xcbicpKTtcclxuICAgICAgaWYgKGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIGNzdkNvbnRlbnQpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KGNzdkNvbnRlbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0VFhUKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIGNvbnN0IG5hbWVGcmFncyA9IGNvbmZpZy5maWxlTmFtZS5zcGxpdCgnLicpO1xyXG4gICAgY29uZmlnLmZpbGVOYW1lID0gYCR7bmFtZUZyYWdzWzBdfS50eHRgO1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q1NWKGNvbmZpZyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFhMUyhjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcblxyXG4gICAgICBjb25zdCBlbGVtZW50OiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG4gICAgICBjb25zdCB3czMgPSBYTFNYLnV0aWxzLnRhYmxlX3RvX3NoZWV0KGVsZW1lbnQsIGNvbmZpZy5vcHRpb25zKTtcclxuICAgICAgY29uc3Qgd2IgPSBYTFNYLnV0aWxzLmJvb2tfbmV3KCk7XHJcbiAgICAgIFhMU1gudXRpbHMuYm9va19hcHBlbmRfc2hlZXQod2IsIHdzMywgY29uZmlnLmZpbGVOYW1lKTtcclxuICAgICAgY29uc3Qgb3V0ID0gWExTWC53cml0ZSh3YiwgeyB0eXBlOiAnYmFzZTY0JyB9KTtcclxuICAgICAgY29uc3QgeGxzQ29udGVudCA9ICdkYXRhOmFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0O2Jhc2U2NCwnICsgb3V0O1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgeGxzQ29udGVudCk7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoeGxzQ29udGVudCk7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRYTFNYKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiB0aGlzLmdldFhMUyhjb25maWcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRET0NYKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgY29udGVudERvY3VtZW50OiBzdHJpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KS5vdXRlckhUTUw7XHJcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSAnPCFET0NUWVBFIGh0bWw+JyArIGNvbnRlbnREb2N1bWVudDtcclxuICAgICAgLy8gSFRNTHRvRE9DWChjb250ZW50LCBudWxsLCBjb25maWcub3B0aW9ucykudGhlbihjb252ZXJ0ZWQgPT4ge1xyXG4gICAgICAvLyAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgLy8gICAgIHRoaXMuZG93bmxvYWRGcm9tQmxvYihjb252ZXJ0ZWQsIGNvbmZpZy5maWxlTmFtZSk7XHJcbiAgICAgIC8vICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIC8vICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICAvLyAgIH0gZWxzZSB7XHJcbiAgICAgIC8vICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG4gICAgICAvLyAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcclxuICAgICAgLy8gICAgICAgY29uc3QgYmFzZTY0ZGF0YSA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xyXG4gICAgICAvLyAgICAgICBvYnNlcnZlci5uZXh0KGJhc2U2NGRhdGEpO1xyXG4gICAgICAvLyAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICAvLyAgICAgfTtcclxuICAgICAgLy8gICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGNvbnZlcnRlZCk7XHJcbiAgICAgIC8vICAgfVxyXG4gICAgICAvLyB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRET0MoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0RE9DWChjb25maWcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRKU09OKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPGFueVtdIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnNlcnZlcikgPT4ge1xyXG4gICAgICBjb25zdCBkYXRhID0gW107IC8vIGZpcnN0IHJvdyBuZWVkcyB0byBiZSBoZWFkZXJzXHJcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSBbXTtcclxuICAgICAgY29uc3QgdGFibGUgPSA8SFRNTFRhYmxlRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRhYmxlLnJvd3NbMF0uY2VsbHMubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICAgICAgaGVhZGVyc1tpbmRleF0gPSB0YWJsZS5yb3dzWzBdLmNlbGxzW2luZGV4XS5pbm5lckhUTUwudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8gL2dpLCAnJyk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gZ28gdGhyb3VnaCBjZWxsc1xyXG4gICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHRhYmxlLnJvd3MubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb25zdCB0YWJsZVJvdyA9IHRhYmxlLnJvd3NbaV07IGNvbnN0IHJvd0RhdGEgPSB7fTtcclxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRhYmxlUm93LmNlbGxzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICByb3dEYXRhW2hlYWRlcnNbal1dID0gdGFibGVSb3cuY2VsbHNbal0uaW5uZXJIVE1MO1xyXG4gICAgICAgIH1cclxuICAgICAgICBkYXRhLnB1c2gocm93RGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QganNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KGRhdGEpO1xyXG4gICAgICBjb25zdCBqc29uQmFzZTY0ID0gdGhpcy5idG9hKGpzb25TdHJpbmcpO1xyXG4gICAgICBjb25zdCBkYXRhU3RyID0gJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsganNvbkJhc2U2NDtcclxuICAgICAgaWYgKGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIGRhdGFTdHIpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0WE1MKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgbGV0IHhtbCA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz48Um9vdD48Q2xhc3Nlcz4nO1xyXG4gICAgICBjb25zdCB0cml0ZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KS5nZXRFbGVtZW50c0J5VGFnTmFtZSgndHInKTtcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cml0ZW0ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb25zdCBjZWxsZGF0YSA9IHRyaXRlbVtpXTtcclxuICAgICAgICBpZiAoY2VsbGRhdGEuY2VsbHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgeG1sICs9ICc8Q2xhc3MgbmFtZT1cIicgKyBjZWxsZGF0YS5jZWxsc1swXS50ZXh0Q29udGVudCArICdcIj5cXG4nO1xyXG4gICAgICAgICAgZm9yIChsZXQgbSA9IDE7IG0gPCBjZWxsZGF0YS5jZWxscy5sZW5ndGg7ICsrbSkge1xyXG4gICAgICAgICAgICB4bWwgKz0gJ1xcdDxkYXRhPicgKyBjZWxsZGF0YS5jZWxsc1ttXS50ZXh0Q29udGVudCArICc8L2RhdGE+XFxuJztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHhtbCArPSAnPC9DbGFzcz5cXG4nO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICB4bWwgKz0gJzwvQ2xhc3Nlcz48L1Jvb3Q+JztcclxuICAgICAgY29uc3QgYmFzZTY0ID0gJ2RhdGE6dGV4dC94bWw7YmFzZTY0LCcgKyB0aGlzLmJ0b2EoeG1sKTtcclxuICAgICAgaWYgKGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIGJhc2U2NCk7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoYmFzZTY0KTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ0b2EoY29udGVudDogc3RyaW5nKSB7XHJcbiAgICByZXR1cm4gYnRvYSh1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQoY29udGVudCkpKTtcclxuICB9XHJcblxyXG59XHJcbiJdfQ==