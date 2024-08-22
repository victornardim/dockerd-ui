$ = document.querySelector.bind(document);

String.prototype.removeANSICharacters = function() {
    return this.replace(/\[.*?m/g, '');
};

String.prototype.removeNonPrintableCharacters = function() {
    return this.replace(/[\x00-\x1F\x7F-\xA0]+/g, '');
}