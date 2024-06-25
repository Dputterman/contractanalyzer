export const extractionPrompt = 
`
Extract content from the file: 20231220 Continental Swift MSA Signed.pdf
Provide the extracted information in the following XML format without any additional text or markup. If information is not available, respond with 'N/A'inside the corresponding tag:
Respond only using the following example. Do not include any markup or source citations:
<contractTitle></contractTitle>
<contractType></contractType>
<contractRole></contractRole>
<contractID></contractID>
<budgetCode></budgetCode>
<effectiveDate></effectiveDate>
<expirationDate></expirationDate>
<renewalDate></renewalDate>
<jurisdiction></jurisdiction>
<contractValue></contractValue>
<contractStatus></contractStatus>
`;

