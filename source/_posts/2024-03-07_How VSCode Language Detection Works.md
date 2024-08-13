---
title: How VSCode Language Detection Works?
date: 2024-03-07 00:00:00
tags:
  - VSCode
  - Language Detection
---

VSCode version 1.60 introduced a new feature to detect the programming language of a file based on its content. This functionality is beneficial for developers. But how is it implemented?

## Overview

The language detection feature is based on a machine learning model trained by [guesslang](https://github.com/yoeo/guesslang).

To run models in the node/browser, the VSCode team uses Tensorflow.js. They load the pre-trained model and encapsulated it into the [vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection) package.

Moreover, to further enhance the precision of language detection further, VSCode employs a private library named `vscode-regexp-languagedetection`. After checking its compressed release package, I found that it also has a built-in model. Improve the model's accuracy by checking the files that were recently opened in your workspace.

After carefully studying the working principle of VSCode language detection, I created an open source repository, [Guesslang Worker](https://github.com/lawvs/guesslang-worker), which can run the language detection model on the browser. Everyone is welcome to use it.

## Details

The language detection feature is primarily implemented in the `languageDetectionSimpleWorker.detectLanguage` method in VSCode. By default, the method will use guesslang to detect the language. If not found, it will use a private regular expression model to detect the language based on your recently opened workspace files.

Here is the simplified version of the `detectLanguage` method:

```ts
// https://github.com/microsoft/vscode/blob/19ecb4b8337d0871f0a204853003a609d716b04e/src/vs/workbench/services/languageDetection/browser/languageDetectionSimpleWorker.ts#L39-L81
export class LanguageDetectionSimpleWorker extends EditorSimpleWorker {
  public async detectLanguage(
    uri: string,
    langBiases: Record<string, number> | undefined,
    // preferHistory: boolean,
    supportedLangs?: string[]
  ): Promise<string | undefined> {
    // Get the text content of the file, max 10000 characters
    const documentTextSample = this.getTextForDetection(uri);
    if (!documentTextSample) {
      return;
    }

    // Run the guesslang model and fine-tune the result
    const neuralResolver = async () => {
      for await (const language of this.detectLanguagesImpl(
        documentTextSample
      )) {
        const coreId = await this._host.fhr("getLanguageId", [
          language.languageId,
        ]);
        if (
          coreId &&
          (!supportedLangs?.length || supportedLangs.includes(coreId))
        ) {
          return coreId;
        }
      }
      return undefined;
    };

    // Guess the language based on the your workspace files
    // The bias is calculated based on the recently opened files in your workspace
    const historicalResolver = async () =>
      this.runRegexpModel(documentTextSample, langBiases ?? {}, supportedLangs);

    const neural = await neuralResolver();
    if (neural) {
      return neural;
    }
    const history = await historicalResolver();
    if (history) {
      return history;
    }
    // Changing the VSCode setting `workbench.editor.historyBasedLanguageDetection` and `workbench.editor.preferHistoryBasedLanguageDetection` can tweak the behavior of the language detection.
    return undefined;
  }
}
```

In [detectLanguagesImpl](https://github.com/microsoft/vscode/blob/19ecb4b8337d0871f0a204853003a609d716b04e/src/vs/workbench/services/languageDetection/browser/languageDetectionSimpleWorker.ts#L215-L275) method, it uses `vscode-languagedetection` to get confidence scores for each language and [adjust language confidence](https://github.com/microsoft/vscode/blob/19ecb4b8337d0871f0a204853003a609d716b04e/src/vs/workbench/services/languageDetection/browser/languageDetectionSimpleWorker.ts#L165-L213) based on VS Code's language usage, finally return the most possible language. For example, the confidence in `js`, `html`, and `json` will increase because they are commonly used in VS Code.

In [languageDetectionWorkerServiceImpl](https://github.com/microsoft/vscode/blob/ea142b5ccdcb797b1de6b1a46fecbf25dea2e229/src/vs/workbench/services/languageDetection/browser/languageDetectionWorkerServiceImpl.ts), it will listen to the workspace and store all your recently opened files' languages and used to calculate a [language bias](https://github.com/microsoft/vscode/blob/ea142b5ccdcb797b1de6b1a46fecbf25dea2e229/src/vs/workbench/services/languageDetection/browser/languageDetectionWorkerServiceImpl.ts#L114-L140) for the regular expression model.

This is a detailed implementation of the language detection feature in VSCode. Though not complex, it is imbued with numerous intricacies.

## おまけ

Beside guesslang, there are other libraries that are used to detect the language. For example, [Magika](https://google.github.io/magika/) is a similar tool to detect common file content types not only programming languages. It is developed by Google and can be used to detect the content type of a file based on its contents.

## References

- [guesslang](https://github.com/yoeo/guesslang)
- [vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection)
- [VSCode Language Detection Implementation](https://github.com/microsoft/vscode/blob/19ecb4b8337d0871f0a204853003a609d716b04e/src/vs/workbench/services/languageDetection/browser/languageDetectionSimpleWorker.ts#L39-L81)
- [Magika - Magika is a tool to detect common file content types, using deep learning.](https://google.github.io/magika/)
- [Guesslang Worker](https://github.com/lawvs/guesslang-worker)
- [vscode-regexp-languagedetection](https://github.com/microsoft/vscode-regexp-languagedetection) (not publicly available)
