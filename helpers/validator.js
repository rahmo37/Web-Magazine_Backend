// This module has all the validation logic.
// This module may contain redundant code intentionally, since the validations are checked on the keyname
// Importing necessary modules
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const getRegexForID = require("../helpers/getRegexForID");

//* Helper functions
function numberErrors(errors) {
  return errors.map((err, index) => `${index + 1}. ${err}`);
}

function isBengaliName(text) {
  const bengaliNameRegex =
    /^(?!.*[\u09E6-\u09EF])[\u0980-\u09FF]+(?: [\u0980-\u09FF]+)*$/;
  return bengaliNameRegex.test(text);
}

function isEnglishName(text) {
  const englishNameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
  return englishNameRegex.test(text);
}

/**
 * Factory for validating a Bangla text field:
 *  - Must not be empty.
 *  - Must be at least `min` characters and no more than `max` characters.
 *  - Must contain at least one Bengali character (other letters, digits, punctuation allowed).
 */
//? Generic helper for bangla text validator
function makeBanglaTextValidator(fieldLabel, { min = 1, max = Infinity } = {}) {
  const banglaRegex = /^(?=.*[\u0980-\u09FF])[\s\S]+$/;

  return function (text) {
    const errors = [];

    // 1. non‑empty
    if (!text || text.trim().length === 0) {
      errors.push(`${fieldLabel} cannot be empty.`);
      return { valid: false, error: numberErrors(errors) };
    }

    const trimmed = text.trim();

    // 2. min length
    if (trimmed.length < min) {
      errors.push(`${fieldLabel} must be at least ${min} characters long.`);
    }

    // 3. max length
    if (trimmed.length > max) {
      errors.push(`${fieldLabel} must be no more than ${max} characters long.`);
    }

    // 4. require at least one Bangla character
    if (!banglaRegex.test(trimmed)) {
      errors.push(
        `${fieldLabel} must include at least one Bengali character (English words are allowed).`
      );
    }

    return {
      valid: errors.length === 0,
      error: numberErrors(errors),
    };
  };
}

//? Generic helper for image check
/**
 * Validates the article cover string:
 *  - Must be provided as a non-empty string.
 *  - Must contain exactly one dot, which separates the filename from the extension.
 *  - The file extension must be one of the allowed types: jpg, jpeg, png, gif, or webp.
 */
function validateImageString(imageStr) {
  const errors = [];
  const allowedTypes = ["jpg", "jpeg", "png", "gif", "webp"];

  if (typeof imageStr !== "string" || !imageStr.trim()) {
    errors.push("Image string must be a non-empty string.");
  } else {
    const parts = imageStr.split(".");
    if (parts.length !== 2) {
      errors.push(
        "Image string must contain exactly one dot separating filename and extension."
      );
    } else {
      const ext = parts.pop().toLowerCase();
      if (!allowedTypes.includes(ext)) {
        errors.push(`Image type must be one of: ${allowedTypes.join(", ")}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
}

// ? Generic function for checking ID
function checkID(prefix, length, message) {
  return function (ID) {
    const errors = [];
    const regex = new RegExp(getRegexForID(prefix, length));

    // Validate the English name part
    if (!regex.test(ID)) {
      errors.push(message);
    }

    return {
      valid: errors.length === 0,
      error: numberErrors(errors),
    };
  };
}

//* Validation logic starts here

// Module Scaffolding
const validator = {};

//! --------------------FirstName
/**
 *  Validates that the name:
 *    - Contains only letters (A-Z, a-z).
 *    - Has no numbers, spaces, or special characters.
 *    - Is not empty.
 */
validator.firstName = function (firstName) {
  const errors = [];

  if (!firstName || typeof firstName !== "string") {
    errors.push("First name must be provided as a non-empty string.");
  } else {
    // Regex pattern to allow only letters
    const nameRegex = /^[A-Za-z]+$/;
    if (!nameRegex.test(firstName)) {
      if (/\d/.test(firstName)) {
        errors.push("First name must not contain numbers.");
      }
      if (/\s/.test(firstName)) {
        errors.push("First name must not contain spaces.");
      }
      if (/[^A-Za-z]/.test(firstName)) {
        errors.push(
          "First name must only contain letters (A-Z, a-z) without any special characters."
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------LastName
/**
 *  Validates that the name:
 *    - Contains only letters (A-Z, a-z).
 *    - Has no numbers, spaces, or special characters.
 *    - Is not empty.
 */
validator.lastName = function (lastName) {
  const errors = [];

  if (!lastName || typeof lastName !== "string") {
    errors.push("Last name must be provided as a non-empty string.");
  } else {
    // Regex pattern to allow only letters
    const nameRegex = /^[A-Za-z]+$/;
    if (!nameRegex.test(lastName)) {
      if (/\d/.test(lastName)) {
        errors.push("Last name must not contain numbers.");
      }
      if (/\s/.test(lastName)) {
        errors.push("Last name must not contain spaces.");
      }
      if (/[^A-Za-z]/.test(lastName)) {
        errors.push(
          "Last name must only contain letters (A-Z, a-z) without any special characters."
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------Email
/**
 *  Validates that the email:
 *    - Contains exactly one "@" symbol.
 *    - Matches a general email format.
 *    - Contains valid characters.
 *    - Has a valid domain name and top-level domain.
 *    - Does not have consecutive, leading, or trailing dots.
 */
validator.email = function (email) {
  const errors = [];

  if (!email || typeof email !== "string") {
    errors.push("Email must be provided as a non-empty string.");
    return { valid: false, error: numberErrors(errors) };
  }

  // Check if email contains exactly one '@'
  if (email.split("@").length !== 2) {
    errors.push("Email must contain exactly one '@' symbol.");
  }

  // Regex pattern for basic email structure
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    errors.push("Email does not match the required format.");
  }

  // Split email into local and domain parts
  const [localPart, domainPart] = email.split("@");
  if (localPart) {
    if (localPart.includes("..")) {
      errors.push("Local part of the email must not contain consecutive dots.");
    }
    if (localPart.startsWith(".") || localPart.endsWith(".")) {
      errors.push("Local part of the email must not start or end with a dot.");
    }
  }
  if (domainPart) {
    if (domainPart.includes("..")) {
      errors.push(
        "Domain part of the email must not contain consecutive dots."
      );
    }
    if (domainPart.startsWith(".") || domainPart.endsWith(".")) {
      errors.push("Domain part of the email must not start or end with a dot.");
    }
    const availableTLDs = ["com", "org", "net", "edu", "gov", "io"];
    if (!availableTLDs.includes(domainPart.split(".")[1].toLocaleLowerCase())) {
      errors.push(`(.${domainPart.split(".")[1]}) is not accepted!`);
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------Phone
/**
 *  Validates the phone number using libphonenumber-js.
 *  If valid, returns an object with the country and international formatted number.
 *  If invalid, returns detailed error messages.
 */
validator.phone = function (phoneNumber) {
  const errors = [];

  if (!phoneNumber || typeof phoneNumber !== "string") {
    errors.push("Phone number must be provided as a non-empty string.");
    return { valid: false, error: numberErrors(errors) };
  }

  const parsedPhoneNumber = parsePhoneNumberFromString(phoneNumber);

  if (!parsedPhoneNumber) {
    errors.push("Phone number could not be parsed.");
    return { valid: false, error: numberErrors(errors) };
  }

  if (!parsedPhoneNumber.isValid()) {
    errors.push("Phone number is invalid.");
    return { valid: false, error: numberErrors(errors) };
  }

  return {
    valid: true,
    error: [],
    country: parsedPhoneNumber.country,
    formatted: parsedPhoneNumber.formatInternational(),
  };
};

//! --------------------Password
/**
 *  Validates that the password:
 *    - Is at least 8 characters long.
 *    - Contains at least one lowercase letter.
 *    - Contains at least one uppercase letter.
 *    - Contains at least one digit.
 *    - Contains at least one special character from !@#$%^&*.
 *    - Contains only allowed characters.
 */
validator.password = function (password) {
  const errors = [];

  if (!password || typeof password !== "string") {
    errors.push("Password must be provided as a non-empty string.");
    return { valid: false, error: numberErrors(errors) };
  }

  // Regex for overall validation
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

  if (!passwordRegex.test(password)) {
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long.");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter.");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter.");
    }
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one digit.");
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push(
        "Password must contain at least one special character from !@#$%^&*."
      );
    }
    if (/[^A-Za-z\d!@#$%^&*]/.test(password)) {
      errors.push(
        "Password contains invalid characters. Only letters, digits, and !@#$%^&* are allowed."
      );
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------Gender
/**
 *  Validates that the gender:
 *    - Is provided as a string.
 *    - Is one of "Male", "Female", or "Other" (case-insensitive and trimmed).
 */
validator.gender = function (gender) {
  const errors = [];

  if (!gender || typeof gender !== "string") {
    errors.push("Gender must be provided as a string.");
    return { valid: false, error: numberErrors(errors) };
  }

  const validGenders = ["male", "female", "other"];
  if (!validGenders.includes(gender.trim().toLowerCase())) {
    errors.push("Gender must be one of 'Male', 'Female', or 'Other'.");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------Date of birth
/**
 *  Validates that the date of birth:
 *    - Is in the format YYYY-MM-DD.
 *    - Represents a real calendar date (no auto-correction by JavaScript).
 *    - Is not in the future.
 */
validator.dateOfBirth = function (dateOfBirth) {
  const errors = [];

  if (!dateOfBirth || typeof dateOfBirth !== "string") {
    errors.push(
      "Date of birth must be provided as a string in YYYY-MM-DD format."
    );
    return { valid: false, error: numberErrors(errors) };
  }

  // Strictly match the format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateOfBirth)) {
    errors.push("Date of birth must be in the format YYYY-MM-DD.");
    return { valid: false, error: numberErrors(errors) };
  }

  const today = new Date();
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const birthDate = new Date(year, month - 1, day);

  // Check for auto-correction discrepancies
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() + 1 !== month ||
    birthDate.getDate() !== day
  ) {
    errors.push("Invalid date provided. Please ensure the date is correct.");
  }

  if (birthDate > today) {
    errors.push("Date of birth cannot be in the future.");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------Department
/**
 * Validates that the department:
 *  - Is provided.
 *  - Is an array.
 *  - Contains at least one element.
 *  - Each department name (after converting to lowercase) is one of the allowed names from process.env.DEPARTMENTS.
 */
function validateDepartmentField(fieldValue, fieldName = "Department") {
  const errors = [];

  if (!fieldValue) {
    errors.push(`${fieldName} is required.`);
    return { valid: false, error: numberErrors(errors) };
  }

  if (!Array.isArray(fieldValue)) {
    errors.push(`${fieldName} field must be an array.`);
    return { valid: false, error: numberErrors(errors) };
  }

  console.log(fieldName);

  if (fieldName === "Department" && fieldValue.length === 0) {
    errors.push(`${fieldName} array must contain at least one element.`);
  }

  const validDepartments = process.env.DEPARTMENTS.split(",");
  const lowerCaseDepts = fieldValue.map((dept) =>
    typeof dept === "string" ? dept.toLowerCase() : ""
  );
  if (!lowerCaseDepts.every((dept) => validDepartments.includes(dept))) {
    errors.push(`Invalid ${fieldName.toLowerCase()} name found!`);
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
}

validator.department = function (department) {
  return validateDepartmentField(department, "Department");
};

validator.deniedDepartment = function (department) {
  return validateDepartmentField(department, "Denied Department");
};


//! --------------------Date Joined
/**
 * Validates the "date joined" value:
 *  - It must be provided as a non-empty string.
 *  - It must follow the format YYYY-MM-DD.
 *  - It must represent a valid date (i.e. no auto-correction issues).
 *  - It must not be a future date.
 */
validator.dateJoined = function (dateJoined) {
  const errors = [];

  if (!dateJoined || typeof dateJoined !== "string") {
    errors.push(
      "Date joined must be provided as a non-empty string in YYYY-MM-DD format."
    );
    return { valid: false, error: numberErrors(errors) };
  }

  // Validate the format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateJoined)) {
    errors.push("Date joined must be in the format YYYY-MM-DD.");
    return { valid: false, error: numberErrors(errors) };
  }

  const today = new Date();
  const [year, month, day] = dateJoined.split("-").map(Number);
  const joinedDate = new Date(year, month - 1, day);

  // Check for auto-correction issues by comparing the parsed values
  if (
    joinedDate.getFullYear() !== year ||
    joinedDate.getMonth() + 1 !== month ||
    joinedDate.getDate() !== day
  ) {
    errors.push(
      "Invalid date provided. Please ensure the date is correct and exists on the calendar."
    );
  }

  if (joinedDate > today) {
    errors.push("Date joined cannot be in the future.");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------employeeType
/**
 * Validates the employee type:
 *  - Checks that the provided employee type is one of the allowed types defined in process.env.EMP_TYPES.
 */
validator.employeeType = function (type) {
  const errors = [];
  const EMP_TYPES = process.env.EMP_TYPES.split(",");

  if (!EMP_TYPES.includes(type)) {
    errors.push("Employee type provided is invalid");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------isActiveAccount
/**
 * Validates that the "isActiveAccount" value:
 *  - Is of type boolean.
 */
validator.isActiveAccount = function (isActiveAccount) {
  const errors = [];

  if (typeof isActiveAccount !== "boolean") {
    errors.push("isActiveAccount must be a boolean value.");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------creatorName
/**
 * Validates the creator name:
 *  - Must be provided as a non-empty string.
 *  - Must contain exactly one underscore separating the English and Bangla names.
 *  - The portion before the underscore must be a valid English name (letters only, with spaces, hyphens or apostrophes allowed).
 *  - The portion after the underscore must be a valid Bangla name (Bengali letters only, with spaces allowed).
 */
validator.creatorName = function (name) {
  const errors = [];
  const EXAMPLE = "(e.g., John_জন)";
  if (!name || typeof name !== "string") {
    errors.push("Creator name must be provided as a non-empty string.");
  } else {
    const namesArr = name.split("_");
    if (namesArr.length !== 2) {
      errors.push(
        "Not a valid creator name, an underscore should separate the English name from the Bangla name. " +
          EXAMPLE
      );
    } else {
      // Validate the English name part
      if (!isEnglishName(namesArr[0])) {
        errors.push(
          "The English name is invalid. Please provide a valid English name before the underscore " +
            EXAMPLE
        );
      }

      // Validate the Bangla name part
      if (!isBengaliName(namesArr[1])) {
        errors.push(
          "The Bangla name is invalid. Please provide a valid Bangla name after the underscore. " +
            EXAMPLE
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------fdcID
validator.fdcID = checkID("fdc_", 12, "Invalid fdcID provided");

//! --------------------sdcID
validator.sdcID = checkID("sdc_", 12, "Invalid sdcID provided");

//! --------------------employeeID
validator.employeeID = checkID("emp_", 6, "Invalid employeeID provided");

//! --------------------upID
validator.upID = checkID(
  "up_",
  12,
  "Invalid upID provided. example: up_123456789321"
);

//! --------------------batchNumber
validator.batchNumber = function checkValidBatchNo(number) {
  const errors = [];
  if (isNaN(number)) {
    errors.push("The value of the batch number must be a number");
  }

  if (number < 1 || number > 10) {
    errors.push(
      "The batch number cannot be less then 1 and cannot be more than 10"
    );
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

// Min-Max boundary for each field
const bioOpts = { min: 50, max: 2000 };
const nameOpts = { min: 5, max: 300 };
const trailerOpts = { min: 25, max: 500 };
const aboutOpts = { min: 25, max: 2000 };
const sectionOpts = { min: 25, max: 4000 };

//! --------------------creatorBio
validator.creatorBio = makeBanglaTextValidator("Creator bio", bioOpts);

//! --------------------articleName
validator.articleName = makeBanglaTextValidator("Article name", nameOpts);

//! --------------------articleTrailer
validator.articleTrailer = makeBanglaTextValidator(
  "Article trailer",
  trailerOpts
);

//! --------------------aboutArticle
validator.aboutArticle = makeBanglaTextValidator("About article", aboutOpts);

//! --------------------sectionArticle
validator.sectionArticle = makeBanglaTextValidator(
  "Section article",
  sectionOpts
);

//! --------------------creatorImage
validator.creatorImage = validateImageString;

//! --------------------articleCover
validator.articleCover = validateImageString;

//! --------------------profilePicture
validator.profilePicture = validateImageString;

//! --------------------themeColor
validator.themeColor = function (color) {
  const errors = [];

  // Current theme colors
  const currentColors = process.env.THEME_COLORS.split(",");

  // If current colors does not have the color passed-in
  if (!currentColors.includes(color.toUpperCase())) {
    errors.push("The color value provided is not acceptable");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------originalWritingDate
/**
 * Validates the "originalWritingDate" value:
 *  - It must be provided as a non-empty string.
 *  - It must follow the format YYYY-MM-DD.
 *  - It must represent a valid date (i.e. no auto-correction issues).
 *  - It must not be a future date.
 */
validator.originalWritingDate = function (originalWritingDate) {
  const errors = [];

  if (!originalWritingDate || typeof originalWritingDate !== "string") {
    errors.push(
      "originalWritingDate must be provided as a non-empty string in YYYY-MM-DD format."
    );
    return { valid: false, error: numberErrors(errors) };
  }

  // Validate the format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(originalWritingDate)) {
    errors.push("originalWritingDate must be in the format YYYY-MM-DD.");
    return { valid: false, error: numberErrors(errors) };
  }

  const today = new Date();
  const [year, month, day] = originalWritingDate.split("-").map(Number);
  const newOriginalWritingDate = new Date(year, month - 1, day);

  // Check for auto-correction issues by comparing the parsed values
  if (
    newOriginalWritingDate.getFullYear() !== year ||
    newOriginalWritingDate.getMonth() + 1 !== month ||
    newOriginalWritingDate.getDate() !== day
  ) {
    errors.push(
      "Invalid date provided. Please ensure the date is correct and exists on the calendar."
    );
  }

  if (newOriginalWritingDate > today) {
    errors.push("originalWritingDate cannot be in the future.");
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------sectionImages
validator.sectionImages = function (images) {
  const errors = [];

  if (!Array.isArray(images)) {
    errors.push("sectionImages must be a non-empty array of image filenames.");
  } else {
    images.forEach((img, idx) => {
      const { valid, error } = validateImageString(img);
      if (!valid) {
        // prefix each element’s errors with its index
        errors.push(`Image at index ${idx}: ${error}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    error: numberErrors(errors),
  };
};

//! --------------------contentStatus
validator.contentStatus = function (status) {
  const errors = [];

  // Retrieve the valid statuses
  const validStatus = process.env.CONTENTSTATUS.split(",");

  // Check the status type and check for falsy value
  if (!status || typeof status !== "string") {
    errors.push(
      `Status must be a non empty string value. (${validStatus.join(", ")})`
    );
    return { valid: false, error: numberErrors(errors) };
  }

  // Check the passed-in status against the validStatus array
  if (!validStatus.includes(status.toLowerCase())) {
    errors.push(
      `Invalid status value provided. Valid values are (${validStatus.join(
        ", "
      )})`
    );
  }

  return { valid: errors.length === 0, error: numberErrors(errors) };
};

module.exports = {
  validator,
};
