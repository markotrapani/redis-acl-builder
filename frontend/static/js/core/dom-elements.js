/**
 * DOM Elements Management
 * Centralized DOM element references and initialization
 */

const DOMElements = {
    aclRuleInput: null,
    resultsSummary: null,
    commandResults: null,
    testCommandInput: null,
    testKeyspaceInput: null,
    testResult: null,
    versionToggle: null,
    modeToggle: null,
    versionDetail: null,

    // Initialize DOM references
    init() {
        this.aclRuleInput = document.getElementById('aclRule');
        this.resultsSummary = document.getElementById('resultsSummary');
        this.commandResults = document.getElementById('commandResults');
        this.testCommandInput = document.getElementById('testCommand');
        this.testKeyspaceInput = document.getElementById('testKeyspace');
        this.testResult = document.getElementById('testResult');
        this.versionToggle = document.getElementById('versionToggle');
        this.modeToggle = document.getElementById('modeToggle');
        this.versionDetail = document.getElementById('versionDetail');
    }
};

export default DOMElements;