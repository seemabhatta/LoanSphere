# Sample Files Directory

This directory contains sample files for testing the loan boarding pipeline.

## Directory Structure

```
sample-files/
├── documents/          # Sample loan documents (PDFs, images)
│   ├── appraisals/
│   ├── credit-reports/ 
│   ├── income-docs/
│   └── property-docs/
├── data/              # Sample data files (JSON, CSV)
│   ├── commitments/
│   ├── purchase-advice/
│   └── uldd/
└── configs/           # Configuration fixtures
    ├── business-rules.json
    ├── agency-configs.json
    └── validation-packs.json
```

## Sample Data Files

- **commitments/**: Agency commitment data (Fannie Mae, Freddie Mac, Ginnie Mae)
- **purchase-advice/**: Purchase advice notifications
- **uldd/**: Uniform Loan Delivery Dataset files
- **documents/**: Sample loan documents for OCR/processing testing

## Usage

Use the SampleDataGenerator to create synthetic data:

```typescript
import { SampleDataGenerator, FixtureLoader } from './sample-data-generator';

// Generate a full loan pipeline
await SampleDataGenerator.generateLoanPipeline(10);

// Generate specific test scenarios  
await SampleDataGenerator.generateTestScenarios();

// Load business rules and agency configs
await FixtureLoader.loadBusinessRules();
await FixtureLoader.loadAgencyConfigs();
```