/**
 * DOM Elements Management
 * Centralized DOM element references and initialization
 */

const DOMElements = {
    aclRuleInput: null,
    resultsSummary: null,
    commandResults: null,
    testCommandInput: null,
    testResult: null,
    versionToggle: null,
    versionDetail: null,
    
    // Initialize DOM references
    init() {
        this.aclRuleInput = document.getElementById('aclRule');
        this.resultsSummary = document.getElementById('resultsSummary');
        this.commandResults = document.getElementById('commandResults');
        this.testCommandInput = document.getElementById('testCommand');
        this.testResult = document.getElementById('testResult');
        this.versionToggle = document.getElementById('versionToggle');
        this.versionDetail = document.getElementById('versionDetail');
    }
};

export default DOMElements;