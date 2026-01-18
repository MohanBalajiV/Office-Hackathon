/**
 * Collection of default prompts for different use cases (ICE POT Format)
 */
export const DEFAULT_PROMPTS = {
  /**
   * Playwright TypeScript Page Object Prompt (No Test File)
   */
  PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: `
    Instructions:
    - Generate ONLY a Playwright TypeScript Page Object (no test files)
    - Use Playwright's Page object pattern and TypeScript types
    - Export a class with methods for DOM interactions
    - Include JSDoc for class and methods
    - Do NOT include explanations or test code

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Example:
    \`\`\`ts
    import { Page } from '@playwright/test';

    /**
     * Page Object for Component Page
     */
    export class ComponentPage {
      private page: Page;
      
      constructor(page: Page) {
        this.page = page;
      }

      /** Navigate to page URL */
      async goto(url: string) {
        await this.page.goto(url);
      }

      /** Click element by selector */
      async clickElement(selector: string) {
        await this.page.click(selector);
      }
    }
    \`\`\`

    Persona:
    - Audience: Senior Automation engineer using Playwright + TypeScript

    Output Format:
    - A single TypeScript class inside a \`\`\`ts\`\`\` block

    Tone:
    - Clean, typed, maintainable
  `,

  /**
   * Selenium Java Page Object Prompt (No Test Class)
   */
  SELENIUM_JAVA_PAGE_ONLY: `
    Instructions:
    - Generate ONLY a Selenium Java Page Object Class (no test code).
    - Add JavaDoc for methods & class.
    - Use Selenium 2.30+ compatible imports.
    - Use meaningful method names.
    - Do NOT include explanations or test code.

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Example:
    \`\`\`java
    package com.agentX.pages;

    /**
     * Page Object for Component Page
     */
    public class ComponentPage {
        // Add methods as per the DOM
    }
    \`\`\`

    Persona:
    - Audience: Senior Automation engineer focusing on maintainable POM structure.

    Output Format:
    - A single Java class inside a \`\`\`java\`\`\` block.

    Tone:
    - Clean, maintainable, enterprise-ready.
  `,

  /**
   * Cucumber Feature File Only Prompt
   */
  CUCUMBER_ONLY: `
    Instructions:
    - Generate ONLY a Cucumber (.feature) file.
    - Use Scenario Outline with Examples table.
    - Make sure every step is relevant to the provided DOM.
    - Do not combine multiple actions into one step.
    - Use South India realistic dataset (names, addresses, pin codes, mobile numbers).
    - Use dropdown values only from provided DOM.
    - Generate multiple scenarios if applicable.

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Example:
    \`\`\`gherkin
    Feature: Login to OpenTaps

    Scenario Outline: Successful login with valid credentials
      Given I open the login page
      When I type "<username>" into the Username field
      And I type "<password>" into the Password field
      And I click the Login button
      Then I should be logged in successfully

    Examples:
      | username   | password  |
      | "testuser" | "testpass"|
      | "admin"    | "admin123"|
    \`\`\`

    Persona:
    - Audience: Senior BDD testers who only need feature files.

    Output Format:
    - Only valid Gherkin in a \`\`\`gherkin\`\`\` block.

    Tone:
    - Clear, structured, executable.
  `,

  /**
   * Test Data Prompt
   */
  TEST_DATA_ONLY: `
    Instructions:
    - Generate test data based on the provided DOM.
    - Output JSON array of objects suitable for test data use (one object per row).
    - Use realistic values where applicable (names, emails, phone numbers, addresses).
    - For dropdown/select fields prefer values found in the DOM.
    - Limit output to a maximum of 10 records unless otherwise requested.

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Output Format:
    - A JSON array inside a \`\`\`json\`\`\` code block.

    Tone:
    - Realistic, concise, ready-to-use in data-driven tests.
  `,

  /**
   * Cucumber with Step Definitions
   */
  CUCUMBER_WITH_SELENIUM_JAVA_STEPS: `
    Instructions:
    - Generate BOTH:
      1. A Cucumber .feature file.
      2. A Java step definition class for selenium.
    - Do NOT include Page Object code.
    - Step defs must include WebDriver setup, explicit waits, and actual Selenium code.
    - Use Scenario Outline with Examples table (South India realistic data).

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`
    URL: \${pageUrl}

    Example:
    \`\`\`gherkin
    Feature: Login to OpenTaps

    Scenario Outline: Successful login with valid credentials
      Given I open the login page
      When I type "<username>" into the Username field
      And I type "<password>" into the Password field
      And I click the Login button
      Then I should be logged in successfully

    Examples:
      | username   | password  |
\      | "admin"    | "admin123"|
    \`\`\`

    \`\`\`java
    package com.example.stepdefs;

    import io.cucumber.java.en.*;
    import org.openqa.selenium.*;
    import org.openqa.selenium.chrome.ChromeDriver;
    import org.openqa.selenium.support.ui.*;

    public class LoginStepDefinitions {
        private WebDriver driver;
        private WebDriverWait wait;

        @io.cucumber.java.Before
        public void setUp() {
            driver = new ChromeDriver();
            wait = new WebDriverWait(driver, Duration.ofSeconds(10));
            driver.manage().window().maximize();
        }

        @io.cucumber.java.After
        public void tearDown() {
            if (driver != null) driver.quit();
        }

        @Given("I open the login page")
        public void openLoginPage() {
            driver.get("\${pageUrl}");
        }

        @When("I type {string} into the Username field")
        public void enterUsername(String username) {
            WebElement el = wait.until(ExpectedConditions.elementToBeClickable(By.id("username")));
            el.sendKeys(username);
        }

        @When("I type {string} into the Password field")
        public void enterPassword(String password) {
            WebElement el = wait.until(ExpectedConditions.elementToBeClickable(By.id("password")));
            el.sendKeys(password);
        }

        @When("I click the Login button")
        public void clickLogin() {
            driver.findElement(By.xpath("//button[contains(text(),'Login')]")).click();
        }

        @Then("I should be logged in successfully")
        public void verifyLogin() {
            WebElement success = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success")));
            assert success.isDisplayed();
        }
    }
    \`\`\`

    Persona:
    - Audience: Senior QA engineers working with Cucumber & Selenium.

    Output Format:
    - Gherkin in \`\`\`gherkin\`\`\` block + Java code in \`\`\`java\`\`\` block.

    Tone:
    - Professional, executable, structured.
  `,

  /**
   * Playwright TypeScript Page Object Prompt (No Test File)
   */
  PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: `
    Instructions:
    - Generate ONLY a Playwright TypeScript Page Object (no test files)
    - Use Playwright's Page object pattern and TypeScript types
    - Export a class with methods for DOM interactions
    - Include JSDoc for class and methods
    - Do NOT include explanations or test code

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Example:
    \`\`\`ts
    import { Page } from '@playwright/test';

    /**
     * Page Object for Component Page
     */
    export class ComponentPage {
      private page: Page;
      
      constructor(page: Page) {
        this.page = page;
      }

      /** Navigate to page URL */
      async goto(url: string) {
        await this.page.goto(url);
      }

      /** Click element by selector */
      async clickElement(selector: string) {
        await this.page.click(selector);
      }
    }
    \`\`\`

    Persona:
    - Audience: Senior Automation engineer using Playwright + TypeScript

    Output Format:
    - A single TypeScript class inside a \`\`\`ts\`\`\` block

    Tone:
    - Clean, typed, maintainable
  `
,
/**
+  * Playwright TypeScript Page Object (No Test File)
+  */
PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: `
+   Instructions:
+   - Generate ONLY a Playwright TypeScript Page Object (no test runner or test files).
+   - Use Playwright's Page object pattern and TypeScript typings.
+   - Export a class (or default-export) with methods mapped to interactions from the DOM.
+   - Include JSDoc for class and methods.
+   - Do NOT include explanations or additional test scaffolding.
+
+   Context:
+   DOM:
+   \`\`\`html
+   \${domContent}
+   \`\`\`
+
+   Example:
+   \`\`\`ts
+   import { Page } from '@playwright/test';
+
+   /**
+    * Page Object for Component Page (Playwright + TypeScript)
+    */
+   export class ComponentPage {
+     private page: Page;
+     constructor(page: Page) {
+       this.page = page;
+     }
+
+     /** Example: navigate to page */
+     async goto() {
+       await this.page.goto('about:blank');
+     }
+   }
+   \`\`\`
+
+   Persona:
+   - Audience: Senior Automation engineer using Playwright + TypeScript.
+
+   Output Format:
+   - A single TypeScript module inside a \`\`\`ts\`\`\` block.
+
+   Tone:
+   - Clean, typed, maintainable.
+ `,
/**
   * Selenium Java Page Object Prompt (No Test Class)
   */
SELENIUM_JAVA_PAGE_ONLY:`
 +Instructions:
    - Generate ONLY a Selenium Java Page Object Class (no test code).
    - Add JavaDoc for methods & class.
    - Use Selenium 2.30+ compatible imports.
    - use fine tuned model
    - Use meaningful method names.
    - Do NOT include explanations or test code.

    Context:
    DOM:
    \`\`\`html
    \${domContent}
    \`\`\`

    Example:
    \`\`\`java
    package com.agentX.pages;

    /**
     * Page Object for Component Page
     */
    public class ComponentPage {
        // Add methods as per the DOM
    }
    \`\`\`

    Persona:
    - Audience: Senior Automation engineer focusing on maintainable POM structure.

    Output Format:
    - A single Java class inside a \`\`\`java\`\`\` block.

    Tone:
    - Clean, maintainable, enterprise-ready.`
}


;

/**
 * Helper function to escape code blocks in prompts
 */
function escapeCodeBlocks(text) {
  return text.replace(/```/g, '\\`\\`\\`');
}

/**
 * Function to fill template variables in a prompt
 */
export function getPrompt(promptKey, variables = {}) {
  let prompt = DEFAULT_PROMPTS[promptKey];
  if (!prompt) {
    throw new Error(`Prompt not found: ${promptKey}`);
  }

  Object.entries(variables).forEach(([k, v]) => {
    const regex = new RegExp(`\\$\\{${k}\\}`, 'g');
    prompt = prompt.replace(regex, v);
  });

  return prompt.trim();
}

export const CODE_GENERATOR_TYPES = {
  SELENIUM_JAVA_PAGE_ONLY: 'Selenium-Java-Page-Only',
  CUCUMBER_ONLY: 'Cucumber-Only',
  CUCUMBER_WITH_SELENIUM_JAVA_STEPS: 'Cucumber-With-Selenium-Java-Steps',
  PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: 'Playwright-Typescript-Page-Only',
  TEST_DATA_ONLY: 'Test-Data-Only',
};
