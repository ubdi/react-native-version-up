"use strict";

const fs = require("fs");
const readlineSync = require("readline-sync");

const helpers = require("./lib/helpers");
const log = require("./lib/log");

const getCurrentInfo = config => {
  const pathToPackage =
    config.pathToPackage || `${config.pathToRoot}/package.json`;

  return {
    info: helpers.getPackageInfo(pathToPackage),
    pathToPackage
  };
};

const versionUp = async config => {
  const { info, pathToPackage } = getCurrentInfo(config);

  const pathToPlist =
    config.pathToPlist || `${config.pathToRoot}/ios/${info.name}/Info.plist`;
  const pathToGradle =
    config.pathToGradle || `${config.pathToRoot}/android/app/build.gradle`;
  // handle case of several plist files
  const pathsToPlists = Array.isArray(pathToPlist)
    ? pathToPlist
    : [pathToPlist];

  // getting next version
  const versionCurrent = info.version;
  const versions = helpers.versions(versionCurrent);
  let major = helpers.version(versions[0], config.major);
  let minor = helpers.version(versions[1], config.minor, config.major);
  let patch = helpers.version(
    versions[2],
    config.patch,
    config.major || config.minor
  );
  const version = `${major}.${minor}.${patch}`;

  // getting next build number
  const buildCurrent = helpers.getBuildNumberFromPlist(pathsToPlists[0]);
  const build = buildCurrent + 1;

  // getting commit message
  const messageTemplate =
    config.m ||
    config.message ||
    "Release ${version}: increase versions and build numbers";
  const message = messageTemplate.replace("${version}", version);

  log.info("\nI'm going to increase the version in:");
  log.info(`- package.json (${pathToPackage});`, 1);
  log.info(`- ios project (${pathsToPlists.join(", ")});`, 1);
  log.info(`- android project (${pathToGradle}).`, 1);

  log.notice(`\nThe version will be changed:`);
  log.notice(`- from: ${versionCurrent} (${buildCurrent});`, 1);
  log.notice(`- to:   ${version} (${build}).`, 1);

  if (version === versionCurrent) {
    log.warning("\nNothing to change in the version. Canceled.");
    process.exit();
  }

  const chain = new Promise((resolve, reject) => {
    log.line();

    if (versions.length !== 3) {
      log.warning(
        `I can\'t understand format of the version "${versionCurrent}".`
      );
    }

    resolve();
  });

  const update = chain
    .then(() => {
      log.notice("\nUpdating versions");
    })
    .then(() => {
      log.info("Updating version in package.json...", 1);

      helpers.changeVersionInPackage(pathToPackage, version);
      log.success(`Version in package.json changed.`, 2);
    })
    .then(() => {
      log.info("Updating version in xcode project...", 1);

      pathsToPlists.forEach(pathToPlist => {
        helpers.changeVersionAndBuildInPlist(pathToPlist, version, build);
      });
      log.success(
        `Version and build number in ios project (plist file) changed.`,
        2
      );
    })
    .then(() => {
      log.info("Updating version in android project...", 1);

      helpers.changeVersionAndBuildInGradle(pathToGradle, version, build);
      log.success(
        `Version and build number in android project (gradle file) changed.`,
        2
      );
    });

  const commit = update.then(() => {
    log.info("Commiting version bump", 1);
    log.info(`"${message} v${version}"`, 2);

    return helpers
      .commitVersionIncrease(version, message, [
        pathToPackage,
        ...pathsToPlists,
        pathToGradle
      ])
      .then(() => {
        log.success(`Commit with files added. Run "git push".`, 1);
      });
  });

  await commit
    .then(() => {
      log.success(`\nDone!`);
    })
    .catch(e => {
      log.line();
      log.error(e);
    });

  return { version, build };
};

module.exports = versionUp;

module.exports.getCurrentInfo = getCurrentInfo;
