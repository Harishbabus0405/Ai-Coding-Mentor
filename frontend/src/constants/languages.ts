import type { LanguageDefinition, SupportedLanguageId } from '../types';

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  {
    id: 'python',
    name: 'Python',
    monacoLanguage: 'python',
    extension: '.py',
    versionLabel: 'Python 3.8+',
    starterCode: `# Write your Python solution here\n\n`,
    exampleCode: `"""
Sample Python Program: Count Tokens from Standard Input
"""
import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        print("Hello from Python! Enter input in the Input tab below.")
        return

    print(f"Received {len(input_data)} input token(s): {input_data}")

if __name__ == "__main__":
    solve()
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from Python! Enter input in the Input tab below.'
      },
      {
        name: 'Two Numbers Token Test',
        stdin: '10 20',
        expectedOutput: "Received 2 input token(s): ['10', '20']"
      },
      {
        name: 'Words Token Test',
        stdin: 'apple banana cherry',
        expectedOutput: "Received 3 input token(s): ['apple', 'banana', 'cherry']"
      }
    ]
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    monacoLanguage: 'javascript',
    extension: '.js',
    versionLabel: 'Node.js 18+',
    starterCode: `// Write your JavaScript solution here\n\n`,
    exampleCode: `/**
 * Sample JavaScript Program: Count Tokens from Standard Input
 */
const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) {
    console.log("Hello from JavaScript! Enter input in the Input tab below.");
    return;
  }

  const tokens = input.split(/\\s+/);
  console.log(\`Received \${tokens.length} input token(s):\`, tokens);
}

solve();
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from JavaScript! Enter input in the Input tab below.'
      },
      {
        name: 'Single Token Test',
        stdin: '42',
        expectedOutput: "Received 1 input token(s): [ '42' ]"
      }
    ]
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    monacoLanguage: 'typescript',
    extension: '.ts',
    versionLabel: 'TypeScript 5.x',
    starterCode: `// Write your TypeScript solution here\n\n`,
    exampleCode: `/**
 * Sample TypeScript Program: Count Tokens from Standard Input
 */
import * as fs from 'fs';

function solve(): void {
  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) {
    console.log("Hello from TypeScript! Enter input in the Input tab below.");
    return;
  }

  const tokens: string[] = input.split(/\\s+/);
  console.log(\`TypeScript parsed \${tokens.length} token(s):\`, tokens);
}

solve();
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from TypeScript! Enter input in the Input tab below.'
      },
      {
        name: 'Sample Numbers',
        stdin: '100 200',
        expectedOutput: "TypeScript parsed 2 token(s): [ '100', '200' ]"
      }
    ]
  },
  {
    id: 'c',
    name: 'C',
    monacoLanguage: 'c',
    extension: '.c',
    versionLabel: 'GCC 9.2+',
    starterCode: `// Write your C solution here\n#include <stdio.h>\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}\n`,
    exampleCode: `/**
 * Sample C Program: Read and Echo Standard Input
 */
#include <stdio.h>
#include <stdlib.h>

int main() {
    char buffer[256];
    
    if (fgets(buffer, sizeof(buffer), stdin) != NULL) {
        printf("Standard Input Read: %s", buffer);
    } else {
        printf("Hello from C! Enter input in the Input tab below.\\n");
    }
    
    return 0;
}
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from C! Enter input in the Input tab below.'
      },
      {
        name: 'Echo String Test',
        stdin: 'Test Line',
        expectedOutput: 'Standard Input Read: Test Line'
      }
    ]
  },
  {
    id: 'cpp',
    name: 'C++',
    monacoLanguage: 'cpp',
    extension: '.cpp',
    versionLabel: 'G++ 9.2+',
    starterCode: `// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}\n`,
    exampleCode: `/**
 * Sample C++ Program: Count Tokens from Standard Input
 */
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string token;
    vector<string> tokens;

    while (cin >> token) {
        tokens.push_back(token);
    }

    if (tokens.empty()) {
        cout << "Hello from C++! Enter input in the Input tab below." << endl;
    } else {
        cout << "C++ parsed " << tokens.size() << " token(s)." << endl;
        for (size_t i = 0; i < tokens.size(); ++i) {
            cout << "  [" << i << "]: " << tokens[i] << endl;
        }
    }

    return 0;
}
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from C++! Enter input in the Input tab below.'
      },
      {
        name: 'Two Tokens Test',
        stdin: 'foo bar',
        expectedOutput: "C++ parsed 2 token(s).\n  [0]: foo\n  [1]: bar"
      }
    ]
  },
  {
    id: 'java',
    name: 'Java',
    monacoLanguage: 'java',
    extension: '.java',
    versionLabel: 'OpenJDK 13+',
    starterCode: `// Write your Java solution here\nimport java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n        \n    }\n}\n`,
    exampleCode: `/**
 * Sample Java Program: Count Tokens from Standard Input
 * Note: Class name must be 'Solution'
 */
import java.util.Scanner;
import java.util.ArrayList;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        ArrayList<String> tokens = new ArrayList<>();

        while (scanner.hasNext()) {
            tokens.add(scanner.next());
        }

        if (tokens.isEmpty()) {
            System.out.println("Hello from Java! Enter input in the Input tab below.");
        } else {
            System.out.println("Java parsed " + tokens.size() + " token(s): " + tokens);
        }

        scanner.close();
    }
}
`,
    starterTestCases: [
      {
        name: 'Empty Input Test',
        stdin: '',
        expectedOutput: 'Hello from Java! Enter input in the Input tab below.'
      },
      {
        name: 'Two Tokens Test',
        stdin: 'hello world',
        expectedOutput: 'Java parsed 2 token(s): [hello, world]'
      }
    ]
  }
];

export const DEFAULT_LANGUAGE_ID: SupportedLanguageId = 'python';

export function getLanguageDefinition(id: SupportedLanguageId): LanguageDefinition {
  const found = SUPPORTED_LANGUAGES.find((lang) => lang.id === id);
  return found || SUPPORTED_LANGUAGES[0];
}
